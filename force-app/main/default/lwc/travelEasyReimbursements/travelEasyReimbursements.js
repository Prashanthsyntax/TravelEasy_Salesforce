
import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';

import REIMBURSEMENT_OBJECT from '@salesforce/schema/Reimbursement__c';
import STATUS_FIELD from '@salesforce/schema/Reimbursement__c.Status__c';
import PAYMENT_METHOD_FIELD from '@salesforce/schema/Reimbursement__c.Payment_Method__c';

import getReimbursements from '@salesforce/apex/TravelEasyReimbursementController.getReimbursements';
import getDashboardSummary from '@salesforce/apex/TravelEasyReimbursementController.getDashboardSummary';
import updateReimbursement from '@salesforce/apex/TravelEasyReimbursementController.updateReimbursement';
import { createRecord } from 'lightning/uiRecordApi';

const ALL_OPTION = { label: 'All statuses', value: '' };
const ALL_METHOD_OPTION = { label: 'All payment methods', value: '' };

export default class TravelEasyReimbursements extends LightningElement {
    showCreateModal = false;

newEmployeeId = '';
newExpenseReportId = '';
newApprovedAmount = '';
newPaymentMethod = '';
newPaymentDate = '';
newPaymentReference = '';
newStatus = '';
newFinanceRemarks = '';

get createPaymentMethodOptions() {
    return [
        { label: 'Bank Transfer', value: 'Bank Transfer' },
        { label: 'UPI', value: 'UPI' },
        { label: 'Other', value: 'Other' }
    ];
}

get createStatusOptions() {
    // Do not offer Paid until the payment has actually been made.
    return this.statusOptions.filter(option =>
        option.value && option.value.toLowerCase() !== 'paid'
    );
}

handleOpenCreate() {
    this.resetCreateForm();
    this.showCreateModal = true;
}

handleCloseCreate() {
    if (!this.isSaving) {
        this.showCreateModal = false;
    }
}

handleEmployeeChange(event) {
    this.newEmployeeId = event.detail.recordId || '';
}

handleExpenseReportChange(event) {
    this.newExpenseReportId = event.detail.recordId || '';
}

handleAmountChange(event) {
    this.newApprovedAmount = event.target.value;
}

handleCreatePaymentMethodChange(event) {
    this.newPaymentMethod = event.detail.value;
}

handleCreateStatusChange(event) {
    this.newStatus = event.detail.value;
}

handlePaymentDateChange(event) {
    this.newPaymentDate = event.target.value;
}

handlePaymentReferenceChange(event) {
    this.newPaymentReference = event.target.value;
}

handleFinanceRemarksChange(event) {
    this.newFinanceRemarks = event.target.value;
}

resetCreateForm() {
    this.newEmployeeId = '';
    this.newExpenseReportId = '';
    this.newApprovedAmount = '';
    this.newPaymentMethod = '';
    this.newPaymentDate = '';
    this.newPaymentReference = '';
    this.newStatus = '';
    this.newFinanceRemarks = '';
}

async handleCreate() {
    const inputs = [
        ...this.template.querySelectorAll(
            'lightning-record-picker, lightning-input, lightning-combobox'
        )
    ];

    const isValid = inputs.reduce((valid, input) => {
        input.reportValidity();
        return valid && input.checkValidity();
    }, true);

    if (!isValid) {
        this.showToast(
            'Check required fields',
            'Complete the required fields with valid values.',
            'error'
        );
        return;
    }

    if (!this.newEmployeeId || !this.newExpenseReportId) {
        this.showToast(
            'Missing information',
            'Select an employee and an Expense Report.',
            'error'
        );
        return;
    }

    const amount = Number(this.newApprovedAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
        this.showToast(
            'Invalid amount',
            'Approved Amount must be greater than zero.',
            'error'
        );
        return;
    }

    this.isSaving = true;

    try {
        const fields = {
            Employee__c: this.newEmployeeId,
            Expense_Report__c: this.newExpenseReportId,
            Approved_Amount__c: amount,
            Payment_Method__c: this.newPaymentMethod,
            Status__c: this.newStatus
        };

        if (this.newPaymentDate) {
            fields.Payment_Date__c = this.newPaymentDate;
        }

        if (this.newPaymentReference.trim()) {
            fields.Payment_Reference__c = this.newPaymentReference.trim();
        }

        if (this.newFinanceRemarks.trim()) {
            fields.Finance_Remarks__c = this.newFinanceRemarks.trim();
        }

        await createRecord({
            apiName: 'Reimbursement__c',
            fields
        });

        this.showToast(
            'Success',
            'Reimbursement created successfully.',
            'success'
        );

        this.showCreateModal = false;
        this.resetCreateForm();

        await Promise.all([
            refreshApex(this.wiredRowsResult),
            refreshApex(this.wiredSummaryResult)
        ]);
    } catch (error) {
        this.showToast(
            'Creation failed',
            error.body?.message || 'Unable to create reimbursement. Check your permissions and required fields.',
            'error'
        );
    } finally {
        this.isSaving = false;
    }
}
    searchTerm = '';
    selectedStatus = '';
    selectedPaymentMethod = '';
    selectedReimbursement;
    statusOptions = [ALL_OPTION];
    paymentMethodOptions = [ALL_METHOD_OPTION];

    reimbursements = [];
    summary = {
        totalReimbursements: 0,
        pendingReimbursements: 0,
        paidReimbursements: 0,
        totalApprovedAmount: 0
    };

    isLoading = true;
    isSaving = false;
    errorMessage;
    wiredRowsResult;
    wiredSummaryResult;

    @wire(getObjectInfo, { objectApiName: REIMBURSEMENT_OBJECT })
    objectInfo;

    @wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: STATUS_FIELD
    })
    loadStatusOptions({ data, error }) {
        if (data) {
            this.statusOptions = [
                ALL_OPTION,
                ...data.values.map(item => ({
                    label: item.label,
                    value: item.value
                }))
            ];
        } else if (error) {
            this.showToast('Error', 'Unable to load status options.', 'error');
        }
    }

    @wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: PAYMENT_METHOD_FIELD
    })
    loadPaymentMethodOptions({ data, error }) {
        if (data) {
            this.paymentMethodOptions = [
                ALL_METHOD_OPTION,
                ...data.values.map(item => ({
                    label: item.label,
                    value: item.value
                }))
            ];
        } else if (error) {
            this.showToast('Error', 'Unable to load payment methods.', 'error');
        }
    }

    @wire(getReimbursements)
    loadReimbursements(result) {
        this.wiredRowsResult = result;

        if (result.data) {
            this.reimbursements = result.data;
            this.errorMessage = undefined;
            this.isLoading = false;
        } else if (result.error) {
            this.errorMessage =
                result.error.body?.message || 'Unable to load reimbursements.';
            this.isLoading = false;
        }
    }

    @wire(getDashboardSummary)
    loadSummary(result) {
        this.wiredSummaryResult = result;

        if (result.data) {
            this.summary = result.data;
        } else if (result.error) {
            this.showToast(
                'Error',
                result.error.body?.message || 'Unable to load summary.',
                'error'
            );
        }
    }

    get filteredReimbursements() {
        const term = (this.searchTerm || '').trim().toLowerCase();

        return this.reimbursements.filter(row => {
            const matchesSearch = !term ||
                (row.reimbursementNumber || '').toLowerCase().includes(term) ||
                (row.employeeName || '').toLowerCase().includes(term) ||
                (row.expenseReportName || '').toLowerCase().includes(term) ||
                (row.paymentReference || '').toLowerCase().includes(term);

            const matchesStatus = !this.selectedStatus ||
                row.status === this.selectedStatus;

            const matchesMethod = !this.selectedPaymentMethod ||
                row.paymentMethod === this.selectedPaymentMethod;

            return matchesSearch && matchesStatus && matchesMethod;
        });
    }

    get hasReimbursements() {
        return this.filteredReimbursements.length > 0;
    }

    get showEmptyState() {
        return !this.isLoading && !this.errorMessage &&
            this.filteredReimbursements.length === 0;
    }

    get showDetails() {
        return Boolean(this.selectedReimbursement);
    }

    get currencyOptions() {
        return {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2
        };
    }

    get totalApprovedAmount() {
        return this.summary.totalApprovedAmount || 0;
    }

    handleSearch(event) {
        this.searchTerm = event.target.value;
    }

    handleStatusFilter(event) {
        this.selectedStatus = event.detail.value;
    }

    handlePaymentMethodFilter(event) {
        this.selectedPaymentMethod = event.detail.value;
    }

    handleView(event) {
        const id = event.currentTarget.dataset.id;
        const record = this.reimbursements.find(item => item.id === id);

        if (record) {
            this.selectedReimbursement = {
                ...record,
                paymentDate: record.paymentDate || '',
                paymentMethod: record.paymentMethod || '',
                paymentReference: record.paymentReference || '',
                status: record.status || '',
                financeRemarks: record.financeRemarks || ''
            };
        }
    }

    handleCloseDetails() {
        this.selectedReimbursement = undefined;
    }

    handleFieldChange(event) {
        const field = event.target.dataset.field;
        this.selectedReimbursement = {
            ...this.selectedReimbursement,
            [field]: event.detail?.value ?? event.target.value
        };
    }

    async handleSave() {
        if (!this.selectedReimbursement) {
            return;
        }

        this.isSaving = true;

        try {
            const row = this.selectedReimbursement;

            await updateReimbursement({
                reimbursementId: row.id,
                paymentDate: row.paymentDate || null,
                paymentMethod: row.paymentMethod || null,
                paymentReference: row.paymentReference || null,
                status: row.status || null,
                financeRemarks: row.financeRemarks || null
            });

            this.showToast('Success', 'Reimbursement updated.', 'success');
            this.selectedReimbursement = undefined;

            await Promise.all([
                refreshApex(this.wiredRowsResult),
                refreshApex(this.wiredSummaryResult)
            ]);
        } catch (error) {
            this.showToast(
                'Update failed',
                error.body?.message || 'Unable to update reimbursement.',
                'error'
            );
        } finally {
            this.isSaving = false;
        }
    }

    async handleRefresh() {
        this.isLoading = true;

        try {
            await Promise.all([
                refreshApex(this.wiredRowsResult),
                refreshApex(this.wiredSummaryResult)
            ]);
        } catch (error) {
            this.showToast('Error', 'Unable to refresh reimbursements.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({ title, message, variant })
        );
    }
}

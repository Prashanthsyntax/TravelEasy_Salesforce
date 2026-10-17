
import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import getExpenseItems from '@salesforce/apex/TravelEasyExpenseItemController.getExpenseItems';
import getDraftReports from '@salesforce/apex/TravelEasyExpenseItemController.getDraftReports';
import createExpenseItem from '@salesforce/apex/TravelEasyExpenseItemController.createExpenseItem';
import updateExpenseItem from '@salesforce/apex/TravelEasyExpenseItemController.updateExpenseItem';
import deleteExpenseItem from '@salesforce/apex/TravelEasyExpenseItemController.deleteExpenseItem';
import isCurrentUserAdmin from '@salesforce/apex/TravelEasyExpenseItemController.isCurrentUserAdmin';

const CURRENCY = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
});

const STATUS_OPTIONS = [
    { label: 'All statuses', value: 'All' },
    { label: 'Submitted', value: 'Submitted' },
    { label: 'Under Review', value: 'Under Review' },
    { label: 'Approved', value: 'Approved' },
    { label: 'Rejected', value: 'Rejected' }
];

const POLICY_OPTIONS = [
    { label: 'All policy statuses', value: 'All' },
    { label: 'Pending', value: 'Pending' },
    { label: 'Within Limit', value: 'Within Limit' },
    { label: 'Exceeded', value: 'Exceeded' },
    { label: 'Not Checked', value: 'Not Checked' },
    { label: 'No Matching Policy', value: 'No Matching Policy' }
];

const CATEGORY_OPTIONS = [
    { label: 'Flight', value: 'Flight' },
    { label: 'Train', value: 'Train' },
    { label: 'Hotel', value: 'Hotel' },
    { label: 'Food', value: 'Food' },
    { label: 'Local Transport', value: 'Local Transport' },
    { label: 'Cab', value: 'Cab' },
    { label: 'Parking', value: 'Parking' },
    { label: 'Other', value: 'Other' }
];

const PAYMENT_OPTIONS = [
    { label: 'Cash', value: 'Cash' },
    { label: 'Credit Card', value: 'Credit Card' },
    { label: 'Debit Card', value: 'Debit Card' },
    { label: 'UPI', value: 'UPI' },
    { label: 'Other', value: 'Other' }
];

const ITEM_STATUS_OPTIONS = [
    { label: 'Submitted', value: 'Submitted' },
    { label: 'Under Review', value: 'Under Review' },
    { label: 'Approved', value: 'Approved' },
    { label: 'Rejected', value: 'Rejected' }
];

function todayString() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 10);
}

function formatDate(value) {
    if (!value) {
        return '—';
    }
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
        return '—';
    }
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(date);
}

function formatCurrency(value) {
    return CURRENCY.format(Number(value) || 0);
}

function statusClass(status) {
    const value = (status || '').toLowerCase();
    if (value === 'approved') {
        return 'status-badge status-success';
    }
    if (value === 'rejected') {
        return 'status-badge status-danger';
    }
    if (value === 'under review') {
        return 'status-badge status-review';
    }
    return 'status-badge status-pending';
}

function policyClass(status) {
    const value = (status || '').toLowerCase();
    if (value === 'within limit') {
        return 'policy-badge policy-success';
    }
    if (value === 'exceeded' || value === 'no matching policy') {
        return 'policy-badge policy-danger';
    }
    return 'policy-badge policy-pending';
}

function blankForm(today) {
    return {
        reportId: '',
        expenseDate: today,
        category: '',
        amount: '',
        paymentMethod: '',
        itemStatus: 'Submitted',
        description: ''
    };
}

export default class TravelEasyExpenseItems extends LightningElement {
    items = [];
    draftReports = [];
    searchTerm = '';
    statusFilter = 'All';
    policyFilter = 'All';

    isLoading = true;
    isSaving = false;
    errorMessage;
    formError;

    showForm = false;
    isEditing = false;
    showDetails = false;
    selectedItemId;
    selectedItem;
    form = blankForm(todayString());

    isNotAdmin = true;
    wiredItemsResult;
    wiredDraftReportsResult;

    acceptedFormats = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'];

    @wire(isCurrentUserAdmin)
    wiredAdmin({ data, error }) {
        if (data !== undefined) {
            this.isNotAdmin = !data;
        } else if (error) {
            this.isNotAdmin = true;
        }
    }

    @wire(getDraftReports)
    wiredReports(result) {
        this.wiredDraftReportsResult = result;
        if (result.data) {
            this.draftReports = result.data.map((report) => ({
                ...report,
                destinationLabel: report.Travel_Request__r?.Destination__c ||
                    report.Travel_Request__r?.Name || 'General Expenses'
            }));
        } else if (result.error) {
            this.draftReports = [];
            this.errorMessage = this.errorText(result.error);
        }
    }

    @wire(getExpenseItems)
    wiredExpenseItems(result) {
        this.wiredItemsResult = result;
        if (result.data) {
            this.items = result.data.map((item) => this.decorateItem(item));
            this.errorMessage = undefined;
            this.isLoading = false;
            this.updateSelectedItem();
        } else if (result.error) {
            this.items = [];
            this.errorMessage = this.errorText(result.error);
            this.isLoading = false;
        }
    }

    get today() {
        return todayString();
    }

    get statusOptions() {
        return STATUS_OPTIONS;
    }

    get policyOptions() {
        return POLICY_OPTIONS;
    }

    get categoryOptions() {
        return CATEGORY_OPTIONS;
    }

    get paymentOptions() {
        return PAYMENT_OPTIONS;
    }

    get itemStatusOptions() {
        return ITEM_STATUS_OPTIONS;
    }

    get draftReportOptions() {
        return this.draftReports.map((report) => ({
            label: `${report.Name} — ${report.destinationLabel}`,
            value: report.Id
        }));
    }

    get totalItems() {
        return this.items.length;
    }

    get formattedTotal() {
        return formatCurrency(this.items.reduce(
            (total, item) => total + (Number(item.Amount__c) || 0), 0
        ));
    }

    get pendingPolicyCount() {
        return this.items.filter((item) =>
            ['Pending', 'Not Checked'].includes(item.Policy_Status__c)
        ).length;
    }

    get draftReportCount() {
        return this.draftReports.length;
    }

    get filteredItems() {
        const search = (this.searchTerm || '').trim().toLowerCase();
        return this.items.filter((item) => {
            const matchesSearch = !search ||
                (item.Name || '').toLowerCase().includes(search) ||
                (item.Description__c || '').toLowerCase().includes(search) ||
                (item.Category__c || '').toLowerCase().includes(search) ||
                (item.reportName || '').toLowerCase().includes(search);

            const matchesStatus = this.statusFilter === 'All' ||
                item.Status__c === this.statusFilter;
            const matchesPolicy = this.policyFilter === 'All' ||
                item.Policy_Status__c === this.policyFilter;

            return matchesSearch && matchesStatus && matchesPolicy;
        });
    }

    get hasItems() {
        return this.filteredItems.length > 0;
    }

    get formTitle() {
        return this.isEditing ? 'Edit Expense Item' : 'Create Expense Item';
    }

    get saveLabel() {
        return this.isSaving ? 'Saving...' : (this.isEditing ? 'Save Changes' : 'Create Expense');
    }

    get saveDisabled() {
        return this.isSaving || this.draftReports.length === 0;
    }

    get editingPolicyStatus() {
        return this.selectedItem?.Policy_Status__c || 'Pending';
    }

    get canEditSelected() {
        return Boolean(this.selectedItem && !this.selectedItem.readOnly);
    }

    decorateItem(item) {
        const report = item.Expense_Report__r;
        const reportName = report?.Name || 'Expense Report';
        const reportStatus = report?.Status__c || '';
        const readOnly = reportStatus !== 'Draft';

        return {
            ...item,
            reportName,
            reportStatus,
            readOnly,
            formattedDate: formatDate(item.Expense_Date__c),
            formattedAmount: formatCurrency(item.Amount__c),
            formattedPolicyLimit: item.Policy_Limit__c == null
                ? 'Not set'
                : formatCurrency(item.Policy_Limit__c),
            statusClass: statusClass(item.Status__c),
            policyClass: policyClass(item.Policy_Status__c)
        };
    }

    handleSearch(event) {
        this.searchTerm = event.target.value;
    }

    handleStatusFilter(event) {
        this.statusFilter = event.detail.value;
    }

    handlePolicyFilter(event) {
        this.policyFilter = event.detail.value;
    }

    handleFieldChange(event) {
        const field = event.target.name;
        const value = event.detail?.value ?? event.target.value;
        this.form = { ...this.form, [field]: value };
    }

    openCreateForm() {
        if (!this.draftReports.length) {
            this.toast(
                'No Draft reports',
                'Create or obtain a Draft expense report before adding an expense item.',
                'warning'
            );
            return;
        }
        this.isEditing = false;
        this.formError = undefined;
        this.form = blankForm(this.today);
        this.showForm = true;
    }

    handleEdit(event) {
        const item = this.items.find((row) => row.Id === event.currentTarget.dataset.id);
        if (!item || item.readOnly) {
            this.toast('Cannot edit', 'Only items belonging to Draft reports can be edited.', 'warning');
            return;
        }

        this.selectedItemId = item.Id;
        this.selectedItem = item;
        this.isEditing = true;
        this.formError = undefined;
        this.form = {
            reportId: item.Expense_Report__c,
            expenseDate: item.Expense_Date__c || this.today,
            category: item.Category__c || '',
            amount: item.Amount__c == null ? '' : String(item.Amount__c),
            paymentMethod: item.Payment_Method__c || '',
            itemStatus: item.Status__c || 'Submitted',
            description: item.Description__c || ''
        };
        this.showForm = true;
    }

    handleView(event) {
        const item = this.items.find((row) => row.Id === event.currentTarget.dataset.id);
        if (!item) {
            return;
        }
        this.selectedItemId = item.Id;
        this.selectedItem = item;
        this.showDetails = true;
    }

    closeDetails() {
        this.showDetails = false;
        this.selectedItemId = undefined;
        this.selectedItem = undefined;
    }

    updateSelectedItem() {
        if (!this.selectedItemId) {
            return;
        }
        this.selectedItem = this.items.find((item) => item.Id === this.selectedItemId);
        if (!this.selectedItem) {
            this.showDetails = false;
        }
    }

    closeForm() {
        if (this.isSaving) {
            return;
        }
        this.showForm = false;
        this.formError = undefined;
    }

    async saveExpense() {
        this.formError = undefined;

        const inputs = [...this.template.querySelectorAll(
            '.expense-modal lightning-input, .expense-modal lightning-combobox, .expense-modal lightning-textarea'
        )];
        const valid = inputs.reduce(
            (allValid, input) => input.reportValidity() && allValid,
            true
        );
        if (!valid) {
            return;
        }

        const amount = Number(this.form.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            this.formError = 'Enter an amount greater than zero.';
            return;
        }

        if (!this.form.reportId) {
            this.formError = 'Select a Draft expense report.';
            return;
        }

        this.isSaving = true;
        try {
            const fields = {
                reportId: this.form.reportId,
                expenseDate: this.form.expenseDate,
                category: this.form.category,
                amount,
                description: this.form.description,
                paymentMethod: this.form.paymentMethod
            };

            if (this.isEditing) {
                await updateExpenseItem({
                    itemId: this.selectedItemId,
                    expenseDate: fields.expenseDate,
                    category: fields.category,
                    amount: fields.amount,
                    description: fields.description,
                    paymentMethod: fields.paymentMethod,
                    itemStatus: this.isNotAdmin ? undefined : this.form.itemStatus
                });
            } else {
                await createExpenseItem(fields);
            }

            this.showForm = false;
            this.toast(
                this.isEditing ? 'Expense updated' : 'Expense created',
                this.isEditing ? 'Expense item updated successfully.' : 'Expense item created successfully.',
                'success'
            );

            await this.refreshData();
        } catch (error) {
            this.formError = this.errorText(error);
        } finally {
            this.isSaving = false;
        }
    }

    async handleDelete(event) {
        const itemId = event.currentTarget.dataset.id;
        const item = this.items.find((row) => row.Id === itemId);

        if (!item || item.readOnly) {
            this.toast('Cannot delete', 'Only items belonging to Draft reports can be deleted.', 'warning');
            return;
        }

        // Confirmation is intentionally explicit before the destructive operation.
        // eslint-disable-next-line no-alert
        if (!window.confirm(`Delete expense item ${item.Name}? This cannot be undone.`)) {
            return;
        }

        this.isLoading = true;
        try {
            await deleteExpenseItem({ itemId });
            if (this.selectedItemId === itemId) {
                this.closeDetails();
            }
            this.toast('Expense deleted', 'The expense item was deleted.', 'success');
            await this.refreshData();
        } catch (error) {
            this.errorMessage = this.errorText(error);
        } finally {
            this.isLoading = false;
        }
    }

    async handleRefresh() {
        this.isLoading = true;
        try {
            await this.refreshData();
        } catch (error) {
            this.errorMessage = this.errorText(error);
        } finally {
            this.isLoading = false;
        }
    }

    async refreshData() {
        const jobs = [];
        if (this.wiredItemsResult) {
            jobs.push(refreshApex(this.wiredItemsResult));
        }
        if (this.wiredDraftReportsResult) {
            jobs.push(refreshApex(this.wiredDraftReportsResult));
        }
        await Promise.all(jobs);
    }

    handleUploadFinished(event) {
        const count = event.detail.files?.length || 0;
        this.toast(
            'Receipt uploaded',
            `${count} file${count === 1 ? '' : 's'} linked to this Expense Item.`,
            'success'
        );
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    errorText(error) {
        if (Array.isArray(error?.body)) {
            return error.body.map((entry) => entry.message).join(', ');
        }
        return error?.body?.message || error?.message ||
            'Something went wrong. Refresh the page and try again.';
    }
}

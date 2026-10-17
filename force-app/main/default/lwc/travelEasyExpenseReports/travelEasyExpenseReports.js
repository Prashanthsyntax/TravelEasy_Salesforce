import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import getMyExpenseReports from '@salesforce/apex/TravelEasyExpenseReportController.getMyExpenseReports';
import getExpenseItems from '@salesforce/apex/TravelEasyExpenseReportController.getExpenseItems';
import createExpenseItem from '@salesforce/apex/TravelEasyExpenseReportController.createExpenseItem';
import createExpenseReport from '@salesforce/apex/TravelEasyExpenseReportController.createExpenseReport';

const STATUS_FILTER_OPTIONS = [
    { label: 'All statuses', value: 'All' },
    { label: 'Draft', value: 'Draft' },
    { label: 'Submitted', value: 'Submitted' },
    { label: 'Under Review', value: 'Under Review' },
    { label: 'Approved', value: 'Approved' },
    { label: 'Rejected', value: 'Rejected' },
    { label: 'Paid', value: 'Paid' }
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

const PAYMENT_METHOD_OPTIONS = [
    { label: 'Cash', value: 'Cash' },
    { label: 'Credit Card', value: 'Credit Card' },
    { label: 'Debit Card', value: 'Debit Card' },
    { label: 'UPI', value: 'UPI' },
    { label: 'Other', value: 'Other' }
];

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

function todayString() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDate(value) {
    if (!value) return '—';

    const parts = String(value).slice(0, 10).split('-');
    if (parts.length !== 3) return String(value);

    const [year, month, day] = parts;
    const date = new Date(Number(year), Number(month) - 1, Number(day));

    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(date);
}

function formatCurrency(value) {
    const amount = Number(value || 0);
    return CURRENCY_FORMATTER.format(
        Number.isFinite(amount) ? amount : 0
    );
}

function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
}

function statusClass(value) {
    const status = normalizeStatus(value);
    const classes = {
        draft: 'status-badge status-draft',
        submitted: 'status-badge status-submitted',
        'under review': 'status-badge status-review',
        approved: 'status-badge status-approved',
        paid: 'status-badge status-paid',
        rejected: 'status-badge status-rejected',
        pending: 'status-badge status-pending'
    };

    return classes[status] || 'status-badge status-default';
}

function policyClass(value) {
    const status = normalizeStatus(value);

    if (status === 'within limit' || status === 'approved') {
        return 'status-badge status-approved';
    }

    if (
        status === 'exceeded' ||
        status === 'rejected' ||
        status === 'no matching policy'
    ) {
        return 'status-badge status-rejected';
    }

    return 'status-badge status-pending';
}

function getErrorMessage(error) {
    if (!error) return 'An unexpected error occurred.';

    if (Array.isArray(error.body)) {
        return error.body
            .map((item) => item.message)
            .filter(Boolean)
            .join(', ');
    }

    if (error.body?.pageErrors?.length) {
        return error.body.pageErrors
            .map((item) => item.message)
            .filter(Boolean)
            .join(', ');
    }

    if (error.body?.fieldErrors) {
        const messages = Object.values(error.body.fieldErrors)
            .flat()
            .map((item) => item.message)
            .filter(Boolean);

        if (messages.length) return messages.join(', ');
    }

    return error.body?.message || error.message || 'Please try again.';
}

function emptyExpense(reportId = '') {
    return {
        reportId,
        expenseDate: todayString(),
        category: '',
        amount: '',
        description: '',
        paymentMethod: ''
    };
}

export default class TravelEasyExpenseReports extends LightningElement {
    reports = [];
    searchTerm = '';
    selectedStatus = 'All';
    isLoading = true;
    errorMessage = '';
    wiredReportsResult;

    selectedReportId = null;
    selectedReport = null;
    expenseItems = [];
    itemsLoading = false;
    itemsError = '';

    showReportForm = false;
    isCreatingReport = false;
    reportFormError = '';
    newReportDate = todayString();
    newTravelRequestId = null;
    newManagerId = null;

    showExpenseForm = false;
    isSaving = false;
    formError = '';
    newExpense = emptyExpense();

    @wire(getMyExpenseReports)
    wiredReports(result) {
        this.wiredReportsResult = result;

        if (result.data) {
            this.reports = result.data.map((record) => {
                const travelRequest = record.Travel_Request__r;
                const destination =
                    travelRequest?.Destination__c ||
                    travelRequest?.Name ||
                    'General Expenses';

                return {
                    ...record,
                    destinationLabel: destination,
                    formattedReportDate: formatDate(record.Report_Date__c),
                    formattedSubmissionDate: formatDate(record.Submission_Date__c),
                    formattedTotal: formatCurrency(record.Total_Amount__c),
                    totalAmountValue: Number(record.Total_Amount__c || 0),
                    statusClass: statusClass(record.Status__c),
                    isDraft: normalizeStatus(record.Status__c) === 'draft',
                    cardClass: record.Id === this.selectedReportId
                        ? 'report-card report-card-selected'
                        : 'report-card'
                };
            });

            this.errorMessage = '';
            this.isLoading = false;
            this.updateSelectedReport();
        } else if (result.error) {
            this.reports = [];
            this.errorMessage = getErrorMessage(result.error);
            this.isLoading = false;
        }
    }

    get today() {
        return todayString();
    }

    get statusFilterOptions() {
        return STATUS_FILTER_OPTIONS;
    }

    get categoryOptions() {
        return CATEGORY_OPTIONS;
    }

    get paymentMethodOptions() {
        return PAYMENT_METHOD_OPTIONS;
    }

    get filteredReports() {
        const search = this.searchTerm.trim().toLowerCase();

        return this.reports
            .filter((report) => {
                const statusMatches =
                    this.selectedStatus === 'All' ||
                    report.Status__c === this.selectedStatus;

                const searchMatches =
                    !search ||
                    String(report.Name || '').toLowerCase().includes(search) ||
                    String(report.destinationLabel || '').toLowerCase().includes(search);

                return statusMatches && searchMatches;
            })
            .map((report) => ({
                ...report,
                cardClass: report.Id === this.selectedReportId
                    ? 'report-card report-card-selected'
                    : 'report-card'
            }));
    }

    get reportOptions() {
        return this.reports
            .filter((report) => report.isDraft)
            .map((report) => ({
                label: `${report.Name} — ${report.destinationLabel}`,
                value: report.Id
            }));
    }

    get totalReports() {
        return this.reports.length;
    }

    get pendingReports() {
        return this.reports.filter((report) => {
            const status = normalizeStatus(report.Status__c);
            return status === 'submitted' || status === 'under review';
        }).length;
    }

    get approvedReports() {
        return this.reports.filter((report) => {
            const status = normalizeStatus(report.Status__c);
            return status === 'approved' || status === 'paid';
        }).length;
    }

    get formattedGrandTotal() {
        const total = this.reports.reduce(
            (sum, report) => sum + Number(report.totalAmountValue || 0),
            0
        );

        return formatCurrency(total);
    }

    get hasReports() {
        return this.filteredReports.length > 0;
    }

    get showDetails() {
        return Boolean(this.selectedReport);
    }

    get hasItems() {
        return this.expenseItems.length > 0;
    }

    get selectedReportIsDraft() {
        return normalizeStatus(this.selectedReport?.Status__c) === 'draft';
    }

    handleOpenReportForm() {
        this.reportFormError = '';
        this.newReportDate = this.today;
        this.newTravelRequestId = null;
        this.newManagerId = null;
        this.showReportForm = true;
    }

    handleCloseReportForm() {
        if (this.isCreatingReport) return;

        this.showReportForm = false;
        this.reportFormError = '';
    }

    handleReportDateChange(event) {
        this.newReportDate = event.detail.value;
        this.reportFormError = '';
    }

    handleTravelRequestChange(event) {
        this.newTravelRequestId = event.detail.recordId || null;
        this.reportFormError = '';
    }

    handleManagerChange(event) {
        this.newManagerId = event.detail.recordId || null;
        this.reportFormError = '';
    }

    async handleCreateReport() {
        this.reportFormError = '';

        // FIX: select the date input using its dedicated data attribute.
        const dateInput = this.template.querySelector('[data-report-date]');

        if (!dateInput) {
            this.reportFormError =
                'Report date input was not found. Add data-report-date to the Report Date lightning-input in the HTML.';
            console.error('TravelEasy: [data-report-date] was not found.');
            return;
        }

        if (!dateInput.reportValidity()) {
            this.reportFormError = 'Please enter a valid report date.';
            return;
        }

        // Read the current value directly from the input.
        this.newReportDate = dateInput.value;

        if (!this.newReportDate) {
            this.reportFormError = 'Please select a report date.';
            return;
        }

        if (this.newReportDate > this.today) {
            this.reportFormError = 'The report date cannot be in the future.';
            return;
        }

        this.isCreatingReport = true;

        try {
            const reportId = await createExpenseReport({
                reportDate: this.newReportDate,
                travelRequestId: this.newTravelRequestId || null,
                managerId: this.newManagerId || null
            });

            if (!reportId) {
                throw new Error('Salesforce returned no expense report ID.');
            }

            this.showReportForm = false;

            if (this.wiredReportsResult) {
                await refreshApex(this.wiredReportsResult);
            }

            this.dispatchEvent(new ShowToastEvent({
                title: 'Expense report created',
                message: 'Your Draft expense report was created successfully.',
                variant: 'success'
            }));

            await this.loadReportDetails(reportId);
        } catch (error) {
            this.reportFormError = getErrorMessage(error);
            console.error('TravelEasy create report error:', error);

            this.dispatchEvent(new ShowToastEvent({
                title: 'Could not create expense report',
                message: this.reportFormError,
                variant: 'error',
                mode: 'sticky'
            }));
        } finally {
            this.isCreatingReport = false;
        }
    }

    handleReportBackdropClick(event) {
        if (event.target === event.currentTarget) {
            this.handleCloseReportForm();
        }
    }

    handleSearchChange(event) {
        this.searchTerm = event.detail.value || '';
    }

    handleStatusChange(event) {
        this.selectedStatus = event.detail.value || 'All';
    }

    handleDismissError() {
        this.errorMessage = '';
    }

    async handleRefresh() {
        if (!this.wiredReportsResult) return;

        this.isLoading = true;

        try {
            await refreshApex(this.wiredReportsResult);
        } catch (error) {
            this.errorMessage = getErrorMessage(error);
        } finally {
            this.isLoading = false;
        }
    }

    async handleViewReport(event) {
        const reportId = event.currentTarget.dataset.id;
        if (reportId) await this.loadReportDetails(reportId);
    }

    async handleAddExpenseToReport(event) {
        const reportId = event.currentTarget.dataset.id;
        if (!reportId) return;

        await this.loadReportDetails(reportId);
        this.openExpenseForm(reportId);
    }

    updateSelectedReport() {
        if (!this.selectedReportId) return;

        const report = this.reports.find(
            (item) => item.Id === this.selectedReportId
        );

        if (report) this.selectedReport = report;
    }

    async loadReportDetails(reportId) {
        this.selectedReportId = reportId;
        this.selectedReport = this.reports.find(
            (report) => report.Id === reportId
        ) || null;

        this.expenseItems = [];
        this.itemsError = '';
        this.itemsLoading = true;

        try {
            const items = await getExpenseItems({ reportId });

            this.expenseItems = (items || []).map((item) => ({
                ...item,
                formattedDate: formatDate(item.Expense_Date__c),
                formattedAmount: formatCurrency(item.Amount__c),
                statusClass: statusClass(item.Status__c),
                policyClass: policyClass(item.Policy_Status__c)
            }));
        } catch (error) {
            this.itemsError = getErrorMessage(error);
        } finally {
            this.itemsLoading = false;
        }
    }

    handleCloseDetails() {
        this.selectedReportId = null;
        this.selectedReport = null;
        this.expenseItems = [];
        this.itemsError = '';
    }

    handleOpenExpenseForm() {
        if (!this.selectedReportId || !this.selectedReportIsDraft) {
            this.formError = 'Select a Draft report before adding an expense.';
            return;
        }

        this.openExpenseForm(this.selectedReportId);
    }

    openExpenseForm(reportId = '') {
        this.formError = '';
        this.newExpense = emptyExpense(reportId);
        this.showExpenseForm = true;
    }

    handleCloseExpenseForm() {
        if (this.isSaving) return;

        this.showExpenseForm = false;
        this.formError = '';
    }

    handleExpenseFieldChange(event) {
        const field = event.target.name;
        const value = event.detail?.value ?? event.target.value;

        this.newExpense = {
            ...this.newExpense,
            [field]: value
        };

        this.formError = '';
    }

    handleExpenseBackdropClick(event) {
        if (event.target === event.currentTarget) {
            this.handleCloseExpenseForm();
        }
    }

    handleModalContentClick(event) {
        event.stopPropagation();
    }

    async handleSaveExpense() {
        this.formError = '';

        const form = this.template.querySelector('[data-expense-form]');

        if (!form) {
            this.formError = 'Expense form was not found.';
            return;
        }

        const inputs = [
            ...form.querySelectorAll('lightning-input, lightning-combobox')
        ];

        let valid = true;

        inputs.forEach((input) => {
            input.reportValidity();
            if (!input.checkValidity()) valid = false;
        });

        if (!valid) {
            this.formError = 'Please complete the required fields correctly.';
            return;
        }

        if (this.newExpense.expenseDate > this.today) {
            this.formError = 'The expense date cannot be in the future.';
            return;
        }

        const amount = Number(this.newExpense.amount);

        if (!Number.isFinite(amount) || amount <= 0) {
            this.formError = 'Enter an amount greater than zero.';
            return;
        }

        this.isSaving = true;

        try {
            const reportId = this.newExpense.reportId;

            await createExpenseItem({
                reportId,
                expenseDate: this.newExpense.expenseDate,
                category: this.newExpense.category,
                amount,
                description: this.newExpense.description || '',
                paymentMethod: this.newExpense.paymentMethod
            });

            this.showExpenseForm = false;

            if (this.wiredReportsResult) {
                await refreshApex(this.wiredReportsResult);
            }

            this.dispatchEvent(new ShowToastEvent({
                title: 'Expense saved',
                message: 'The expense item was added successfully.',
                variant: 'success'
            }));

            await this.loadReportDetails(reportId);
        } catch (error) {
            this.formError = getErrorMessage(error);
            console.error('TravelEasy create expense error:', error);

            this.dispatchEvent(new ShowToastEvent({
                title: 'Could not save expense',
                message: this.formError,
                variant: 'error',
                mode: 'sticky'
            }));
        } finally {
            this.isSaving = false;
        }
    }
}
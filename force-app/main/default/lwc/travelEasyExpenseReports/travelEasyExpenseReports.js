
import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import getMyExpenseReports
    from '@salesforce/apex/TravelEasyExpenseReportController.getMyExpenseReports';
import getExpenseItems
    from '@salesforce/apex/TravelEasyExpenseReportController.getExpenseItems';
import createExpenseItem
    from '@salesforce/apex/TravelEasyExpenseReportController.createExpenseItem';

const STATUS_OPTIONS = [
    { label: 'All Statuses', value: 'All' },
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

const PAYMENT_OPTIONS = [
    { label: 'Cash', value: 'Cash' },
    { label: 'Credit Card', value: 'Credit Card' },
    { label: 'Debit Card', value: 'Debit Card' },
    { label: 'UPI', value: 'UPI' },
    { label: 'Other', value: 'Other' }
];

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
});

function formatDate(value) {
    if (!value) {
        return '—';
    }

    const date = new Date(`${value}T00:00:00`);

    return Number.isNaN(date.getTime())
        ? '—'
        : new Intl.DateTimeFormat('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
          }).format(date);
}

function formatCurrency(value) {
    return CURRENCY_FORMATTER.format(Number(value) || 0);
}

function statusClass(status) {
    const normalized = (status || '').toLowerCase();

    if (normalized === 'approved' || normalized === 'paid') {
        return 'status-badge status-success';
    }

    if (normalized === 'rejected') {
        return 'status-badge status-danger';
    }

    if (normalized === 'under review') {
        return 'status-badge status-review';
    }

    return 'status-badge status-pending';
}

function policyClass(status) {
    const normalized = (status || '').toLowerCase();

    if (normalized === 'within limit') {
        return 'policy-badge policy-success';
    }

    if (
        normalized === 'exceeded' ||
        normalized === 'no matching policy'
    ) {
        return 'policy-badge policy-danger';
    }

    return 'policy-badge policy-pending';
}

function getTodayString() {
    const now = new Date();
    const localDate = new Date(
        now.getTime() - now.getTimezoneOffset() * 60000
    );

    return localDate.toISOString().slice(0, 10);
}

function emptyExpense(today) {
    return {
        reportId: '',
        expenseDate: today,
        category: '',
        amount: '',
        paymentMethod: '',
        description: ''
    };
}

export default class TravelEasyExpenseReports extends LightningElement {
    reports = [];
    expenseItems = [];

    searchTerm = '';
    selectedStatus = 'All';

    selectedReportId;
    selectedReport;

    isLoading = true;
    itemsLoading = false;
    errorMessage;
    itemsError;

    wiredReportsResult;

    showExpenseForm = false;
    isSaving = false;
    formError;
    newExpense = emptyExpense(getTodayString());

    @wire(getMyExpenseReports)
    wiredReports(result) {
        this.wiredReportsResult = result;

        const { data, error } = result;

        if (data) {
            this.reports = data.map((report) => ({
                ...report,
                destinationLabel:
                    report.Travel_Request__r?.Destination__c ||
                    report.Travel_Request__r?.Name ||
                    'General Expenses',
                formattedReportDate: formatDate(report.Report_Date__c),
                formattedTotal: formatCurrency(report.Total_Amount__c),
                statusClass: statusClass(report.Status__c)
            }));

            this.errorMessage = undefined;
            this.isLoading = false;
            this.updateSelectedReport();
        } else if (error) {
            this.reports = [];
            this.errorMessage = this.getErrorMessage(error);
            this.isLoading = false;
        }
    }

    get today() {
        return getTodayString();
    }

    get statusOptions() {
        return STATUS_OPTIONS;
    }

    get categoryOptions() {
        return CATEGORY_OPTIONS;
    }

    get paymentOptions() {
        return PAYMENT_OPTIONS;
    }

    get reportOptions() {
        return this.reports
            .filter((report) => report.Status__c === 'Draft')
            .map((report) => ({
                label: `${report.Name} — ${report.destinationLabel}`,
                value: report.Id
            }));
    }

    get noDraftReports() {
        return this.reportOptions.length === 0;
    }

    get saveDisabled() {
        return this.isSaving || this.noDraftReports;
    }

    get filteredReports() {
        const search = (this.searchTerm || '').trim().toLowerCase();

        return this.reports.filter((report) => {
            const matchesStatus =
                this.selectedStatus === 'All' ||
                report.Status__c === this.selectedStatus;

            const matchesSearch =
                !search ||
                (report.Name || '').toLowerCase().includes(search) ||
                (report.destinationLabel || '').toLowerCase().includes(search);

            return matchesStatus && matchesSearch;
        });
    }

    get totalReports() {
        return this.reports.length;
    }

    get pendingReports() {
        return this.reports.filter((report) =>
            ['Draft', 'Submitted', 'Under Review'].includes(report.Status__c)
        ).length;
    }

    get approvedReports() {
        return this.reports.filter((report) =>
            ['Approved', 'Paid'].includes(report.Status__c)
        ).length;
    }

    get formattedGrandTotal() {
        const total = this.reports.reduce(
            (sum, report) => sum + (Number(report.Total_Amount__c) || 0),
            0
        );

        return formatCurrency(total);
    }

    get hasReports() {
        return this.filteredReports.length > 0;
    }

    get showDetails() {
        return Boolean(this.selectedReportId && this.selectedReport);
    }

    get hasItems() {
        return this.expenseItems.length > 0;
    }

    get selectedReportIsDraft() {
        return this.selectedReport?.Status__c === 'Draft';
    }

    handleSearch(event) {
        this.searchTerm = event.target.value;
    }

    handleStatusFilter(event) {
        this.selectedStatus = event.detail.value;
    }

    async handleRefresh() {
        this.isLoading = true;
        this.errorMessage = undefined;

        try {
            if (this.wiredReportsResult) {
                await refreshApex(this.wiredReportsResult);
            }
        } catch (error) {
            this.errorMessage = this.getErrorMessage(error);
        } finally {
            this.isLoading = false;
        }
    }

    async handleViewDetails(event) {
        const reportId = event.currentTarget.dataset.id;
        await this.loadReportDetails(reportId);
    }

    async loadReportDetails(reportId) {
        this.selectedReportId = reportId;
        this.updateSelectedReport();
        this.expenseItems = [];
        this.itemsError = undefined;
        this.itemsLoading = true;

        try {
            const data = await getExpenseItems({ reportId });

            this.expenseItems = (data || []).map((item) => ({
                ...item,
                formattedDate: formatDate(item.Expense_Date__c),
                formattedAmount: formatCurrency(item.Amount__c),
                policyClass: policyClass(item.Policy_Status__c)
            }));
        } catch (error) {
            this.itemsError = this.getErrorMessage(error);
        } finally {
            this.itemsLoading = false;
        }
    }

    handleCloseDetails() {
        this.selectedReportId = undefined;
        this.selectedReport = undefined;
        this.expenseItems = [];
        this.itemsError = undefined;
    }

    updateSelectedReport() {
        this.selectedReport =
            this.reports.find(
                (report) => report.Id === this.selectedReportId
            ) || undefined;
    }

    handleOpenExpenseForm() {
        this.formError = undefined;

        this.newExpense = {
            ...emptyExpense(this.today),
            reportId:
                this.selectedReport?.Status__c === 'Draft'
                    ? this.selectedReportId
                    : ''
        };

        this.showExpenseForm = true;
    }

    handleCloseExpenseForm() {
        if (this.isSaving) {
            return;
        }

        this.showExpenseForm = false;
        this.formError = undefined;
    }

    handleExpenseFieldChange(event) {
        const field = event.target.name;
        const value = event.detail?.value ?? event.target.value;

        this.newExpense = {
            ...this.newExpense,
            [field]: value
        };
    }

    async handleSaveExpense() {
        this.formError = undefined;

        const form = this.template.querySelector('.expense-modal');

        if (!form) {
            this.formError = 'Unable to open the expense form. Please try again.';
            return;
        }

        const inputs = [
            ...form.querySelectorAll(
                'lightning-input, lightning-combobox'
            )
        ];

        const valid = inputs.reduce(
            (allValid, input) => input.reportValidity() && allValid,
            true
        );

        if (!valid) {
            return;
        }

        const amount = Number(this.newExpense.amount);

        if (!Number.isFinite(amount) || amount <= 0) {
            this.formError = 'Enter an amount greater than zero.';
            return;
        }

        if (!this.newExpense.reportId) {
            this.formError = 'Please select a Draft expense report.';
            return;
        }

        const savedReportId = this.newExpense.reportId;
        this.isSaving = true;

        try {
            await createExpenseItem({
                reportId: savedReportId,
                expenseDate: this.newExpense.expenseDate,
                category: this.newExpense.category,
                amount,
                description: this.newExpense.description,
                paymentMethod: this.newExpense.paymentMethod
            });

            this.showExpenseForm = false;

            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Expense created',
                    message: 'Your expense was saved successfully.',
                    variant: 'success'
                })
            );

            if (this.wiredReportsResult) {
                await refreshApex(this.wiredReportsResult);
            }

            // Keep the selected report open and reload its expense items.
            await this.loadReportDetails(savedReportId);
        } catch (error) {
            this.formError = this.getErrorMessage(error);
            this.showExpenseForm = true;
        } finally {
            this.isSaving = false;
        }
    }

    getErrorMessage(error) {
        if (Array.isArray(error?.body)) {
            return error.body.map((item) => item.message).join(', ');
        }

        return (
            error?.body?.message ||
            error?.message ||
            'Something went wrong. Please refresh and try again.'
        );
    }
}


import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';

import getMyExpenseReports
    from '@salesforce/apex/TravelEasyExpenseReportController.getMyExpenseReports';
import getExpenseItems
    from '@salesforce/apex/TravelEasyExpenseReportController.getExpenseItems';

const STATUS_OPTIONS = [
    { label: 'All Statuses', value: 'All' },
    { label: 'Draft', value: 'Draft' },
    { label: 'Submitted', value: 'Submitted' },
    { label: 'Under Review', value: 'Under Review' },
    { label: 'Approved', value: 'Approved' },
    { label: 'Rejected', value: 'Rejected' },
    { label: 'Paid', value: 'Paid' }
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

    const date = new Date(value);

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

    get statusOptions() {
        return STATUS_OPTIONS;
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
        this.selectedReportId = event.currentTarget.dataset.id;
        this.updateSelectedReport();
        this.expenseItems = [];
        this.itemsError = undefined;
        this.itemsLoading = true;

        try {
            const data = await getExpenseItems({
                reportId: this.selectedReportId
            });

            this.expenseItems = data.map((item) => ({
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

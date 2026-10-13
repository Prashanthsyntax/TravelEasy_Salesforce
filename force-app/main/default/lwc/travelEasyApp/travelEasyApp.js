
import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';

import getDashboardData from '@salesforce/apex/TravelEasyDashboardController.getDashboardData';
import getTravelRequests from '@salesforce/apex/TravelEasyTravelRequestController.getTravelRequests';

export default class TravelEasyApp extends LightningElement {
    // Page navigation
    showDashboardPage = true;
    showTravelRequestsPage = false;
    showTravelRequestFlow = false;
    showItinerariesPage = false;
    showExpenseReportsPage = false;

    // Dashboard data
    userName = 'User';
    totalRequests = 0;
    pendingApprovals = 0;
    totalExpenses = 0;
    totalReimbursements = 0;
    recentRequests = [];
    isManagerUser = false;
    isLoading = true;
    errorMessage;
    wiredDashboardResult;

    // Travel Requests data
    travelRequests = [];
    isRequestsLoading = false;
    requestsError;

    // Load dashboard information from Apex
    @wire(getDashboardData)
    loadDashboardData(result) {
        this.wiredDashboardResult = result;

        const { data, error } = result;

        if (data) {
            this.userName = data.userName || 'User';
            this.isManagerUser = data.isManager ?? false;
            this.totalRequests = data.totalRequests ?? 0;
            this.pendingApprovals = data.pendingApprovals ?? 0;
            this.totalExpenses = data.totalExpenses ?? 0;
            this.totalReimbursements = data.totalReimbursements ?? 0;
            this.recentRequests = data.recentRequests || [];

            this.errorMessage = undefined;
            this.isLoading = false;
        } else if (error) {
            this.errorMessage =
                error.body?.message || 'Unable to load dashboard data.';

            this.isLoading = false;

            console.error('TravelEasy dashboard error:', error);
        }
    }

    // Open Dashboard
    handleDashboardClick() {
        this.showDashboardPage = true;
        this.showTravelRequestsPage = false;
        this.showTravelRequestFlow = false;
        this.showItinerariesPage = false;
        this.showExpenseReportsPage = false;
    }

    // Open Travel Requests
    handleTravelRequestsClick() {
        this.showDashboardPage = false;
        this.showTravelRequestsPage = true;
        this.showTravelRequestFlow = false;
        this.showItinerariesPage = false;
        this.showExpenseReportsPage = false;

        return this.loadTravelRequests();
    }

    // Open the new Travel Request Screen Flow
    handleNewTravelRequest() {
        this.showDashboardPage = false;
        this.showTravelRequestsPage = true;
        this.showTravelRequestFlow = true;
        this.showItinerariesPage = false;
        this.showExpenseReportsPage = false;
    }

    // Open Travel Itineraries
    handleItinerariesClick() {
        this.showDashboardPage = false;
        this.showTravelRequestsPage = false;
        this.showTravelRequestFlow = false;
        this.showItinerariesPage = true;
        this.showExpenseReportsPage = false;
    }

    // Open Expense Reports
    handleExpenseReportsClick() {
        this.showDashboardPage = false;
        this.showTravelRequestsPage = false;
        this.showTravelRequestFlow = false;
        this.showItinerariesPage = false;
        this.showExpenseReportsPage = true;
    }

    // Refresh Travel Requests
    handleRefreshRequests() {
        return this.loadTravelRequests();
    }

    // Retrieve Travel Requests from Apex
    async loadTravelRequests() {
        this.isRequestsLoading = true;
        this.requestsError = undefined;

        try {
            this.travelRequests = (await getTravelRequests()) || [];
        } catch (error) {
            this.requestsError =
                error.body?.message || 'Unable to load travel requests.';

            console.error('Travel Requests error:', error);
        } finally {
            this.isRequestsLoading = false;
        }
    }

    // Handle completion of the Travel Request Screen Flow
    async handleFlowStatusChange(event) {
        if (event.detail.status === 'FINISHED') {
            this.showTravelRequestFlow = false;

            await this.loadTravelRequests();

            // Refresh dashboard values after a new request is saved
            if (this.wiredDashboardResult) {
                try {
                    await refreshApex(this.wiredDashboardResult);
                } catch (error) {
                    console.error(
                        'Unable to refresh TravelEasy dashboard:',
                        error
                    );
                }
            }
        }
    }

    // Welcome message
    get welcomeMessage() {
        return `Welcome back, ${this.userName}!`;
    }

    // User avatar initial
    get userInitial() {
        return this.userName
            ? this.userName.trim().charAt(0).toUpperCase()
            : 'U';
    }

    // User role label
    get userRoleLabel() {
        return this.isManagerUser ? 'Travel Manager' : 'Travel Employee';
    }

    // Current page title
    get currentPageTitle() {
        if (this.showExpenseReportsPage) {
            return 'Expense Reports';
        }

        if (this.showItinerariesPage) {
            return 'Itineraries';
        }

        if (this.showTravelRequestsPage) {
            return 'Travel Requests';
        }

        return 'Dashboard';
    }

    // Sidebar active styles
    get dashboardNavClass() {
        return this.showDashboardPage
            ? 'nav-item active'
            : 'nav-item';
    }

    get travelRequestsNavClass() {
        return this.showTravelRequestsPage
            ? 'nav-item active'
            : 'nav-item';
    }

    get itinerariesNavClass() {
        return this.showItinerariesPage
            ? 'nav-item active'
            : 'nav-item';
    }

    get expenseReportsNavClass() {
        return this.showExpenseReportsPage
            ? 'nav-item active'
            : 'nav-item';
    }

    // Dashboard and Travel Requests template helpers
    get hasRecentRequests() {
        return this.recentRequests.length > 0;
    }

    get hasTravelRequests() {
        return this.travelRequests.length > 0;
    }

    get hasError() {
        return Boolean(this.errorMessage);
    }
}

import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getDashboardData from '@salesforce/apex/TravelEasyDashboardController.getDashboardData';
import getTravelRequests from '@salesforce/apex/TravelEasyTravelRequestController.getTravelRequests';

export default class TravelEasyApp extends LightningElement {
    showDashboardPage = true;
    showTravelRequestsPage = false;
    showTravelRequestFlow = false;

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

    travelRequests = [];
    isRequestsLoading = false;
    requestsError;

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
            this.errorMessage = error.body?.message || 'Unable to load dashboard data.';
            this.isLoading = false;
            console.error('TravelEasy dashboard error:', error);
        }
    }

    handleDashboardClick() {
        this.showDashboardPage = true;
        this.showTravelRequestsPage = false;
        this.showTravelRequestFlow = false;
    }

    handleTravelRequestsClick() {
        this.showDashboardPage = false;
        this.showTravelRequestsPage = true;
        this.showTravelRequestFlow = false;
        this.loadTravelRequests();
    }

    handleNewTravelRequest() {
        this.showDashboardPage = false;
        this.showTravelRequestsPage = true;
        this.showTravelRequestFlow = true;
    }

    handleRefreshRequests() {
        return this.loadTravelRequests();
    }

    async loadTravelRequests() {
        this.isRequestsLoading = true;
        this.requestsError = undefined;
        try {
            this.travelRequests = (await getTravelRequests()) || [];
        } catch (error) {
            this.requestsError = error.body?.message || 'Unable to load travel requests.';
            console.error('Travel Requests error:', error);
        } finally {
            this.isRequestsLoading = false;
        }
    }

    async handleFlowStatusChange(event) {
        if (event.detail.status === 'FINISHED') {
            this.showTravelRequestFlow = false;
            await this.loadTravelRequests();

            if (this.wiredDashboardResult) {
                try {
                    await refreshApex(this.wiredDashboardResult);
                } catch (error) {
                    console.error('Unable to refresh TravelEasy dashboard:', error);
                }
            }
        }
    }

    get welcomeMessage() {
        return `Welcome back, ${this.userName}!`;
    }

    get userInitial() {
        return this.userName ? this.userName.trim().charAt(0).toUpperCase() : 'U';
    }

    get userRoleLabel() {
        return this.isManagerUser ? 'Travel Manager' : 'Travel Employee';
    }

    get currentPageTitle() {
        return this.showTravelRequestsPage ? 'Travel Requests' : 'Dashboard';
    }

    get dashboardNavClass() {
        return this.showDashboardPage ? 'nav-item active' : 'nav-item';
    }

    get travelRequestsNavClass() {
        return this.showTravelRequestsPage ? 'nav-item active' : 'nav-item';
    }

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

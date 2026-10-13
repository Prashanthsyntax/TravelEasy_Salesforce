
import { LightningElement, wire } from 'lwc';
import getDashboardData from '@salesforce/apex/TravelEasyDashboardController.getDashboardData';

export default class TravelEasyApp extends LightningElement {
    userName = 'User';
    totalRequests = 0;
    pendingApprovals = 0;
    totalExpenses = 0;
    totalReimbursements = 0;
    recentRequests = [];

    userMode = 'Employee';
    isManagerUser = false;
    isLoading = true;
    errorMessage;

    @wire(getDashboardData)
    loadDashboardData({ data, error }) {
        if (data) {
            this.userName = data.userName || 'User';
            this.isManagerUser = data.isManager ?? false;
            this.userMode = this.isManagerUser ? 'Manager' : 'Employee';
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

    get welcomeMessage() {
        return `Welcome back, ${this.userName}!`;
    }

    get isEmployee() {
        return !this.isManagerUser;
    }

    get isManager() {
        return this.isManagerUser;
    }

    get hasError() {
        return Boolean(this.errorMessage);
    }
}

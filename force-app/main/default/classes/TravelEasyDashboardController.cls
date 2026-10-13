
public with sharing class TravelEasyDashboardController {

    public class DashboardData {
        @AuraEnabled public Integer totalRequests { get; set; }
        @AuraEnabled public Integer pendingApprovals { get; set; }
        @AuraEnabled public Decimal totalExpenses { get; set; }
        @AuraEnabled public Decimal totalReimbursements { get; set; }
        @AuraEnabled public String userName { get; set; }
        @AuraEnabled public Boolean isManager { get; set; }
        @AuraEnabled public List<Travel_Request__c> recentRequests { get; set; }
    }

    @AuraEnabled(cacheable=true)
    public static DashboardData getDashboardData() {
        DashboardData data = new DashboardData();

        Id currentUserId = UserInfo.getUserId();

        data.userName = UserInfo.getName();

        data.isManager = FeatureManagement.checkPermission(
            'TravelEasy_Manager_Access'
        );

        data.totalRequests = [
            SELECT COUNT()
            FROM Travel_Request__c
            WHERE Employee_User__c = :currentUserId
            WITH USER_MODE
        ];

        data.pendingApprovals = [
            SELECT COUNT()
            FROM Travel_Request__c
            WHERE Manager_User__c = :currentUserId
            AND Status__c IN ('Submitted', 'Under Review')
            WITH USER_MODE
        ];

        AggregateResult expenseResult = [
            SELECT SUM(Amount__c) totalAmount
            FROM Expense_Item__c
            WHERE Expense_Report__r.Employee__c = :currentUserId
            WITH USER_MODE
        ];

        data.totalExpenses = (Decimal) expenseResult.get('totalAmount');

        if (data.totalExpenses == null) {
            data.totalExpenses = 0;
        }
        
        AggregateResult reimbursementResult = [
            SELECT SUM(Approved_Amount__c) totalAmount
            FROM Reimbursement__c
            WHERE Employee__c = :currentUserId
            WITH USER_MODE
        ];

        data.totalReimbursements = (Decimal) reimbursementResult.get('totalAmount');

        if (data.totalReimbursements == null) {
            data.totalReimbursements = 0;
        }

        data.recentRequests = [
            SELECT Id, Name, Destination__c, From_Location__c,
                Start_Date__c, End_Date__c, Estimated_Cost__c, Status__c
            FROM Travel_Request__c
            WHERE Employee_User__c = :currentUserId
            WITH USER_MODE
            ORDER BY CreatedDate DESC
            LIMIT 5
        ];

        return data;
    }
}

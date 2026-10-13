
public with sharing class TravelEasyExpenseReportController {

    @AuraEnabled(cacheable=true)
    public static List<Expense_Report__c> getMyExpenseReports() {
        Id currentUserId = UserInfo.getUserId();

        return [
            SELECT Id,
                   Name,
                   Report_Date__c,
                   Submission_Date__c,
                   Approval_Date__c,
                   Status__c,
                   Total_Amount__c,
                   Rejection_Reason__c,
                   Employee__c,
                   Employee__r.Name,
                   Manager__c,
                   Manager__r.Name,
                   Travel_Request__c,
                   Travel_Request__r.Name,
                   Travel_Request__r.Destination__c
            FROM Expense_Report__c
            WHERE Employee__c = :currentUserId
            WITH USER_MODE
            ORDER BY Report_Date__c DESC
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Expense_Item__c> getExpenseItems(Id reportId) {
        if (reportId == null) {
            throw new AuraHandledException('Please select an expense report.');
        }

        return [
            SELECT Id,
                   Name,
                   Expense_Report__c,
                   Expense_Date__c,
                   Category__c,
                   Amount__c,
                   Description__c,
                   Payment_Method__c,
                   Status__c,
                   Policy_Status__c,
                   Policy_Limit__c,
                   Policy_Check_Notes__c,
                   Rejection_Reason__c
            FROM Expense_Item__c
            WHERE Expense_Report__c = :reportId
            WITH USER_MODE
            ORDER BY Expense_Date__c DESC
        ];
    }
}

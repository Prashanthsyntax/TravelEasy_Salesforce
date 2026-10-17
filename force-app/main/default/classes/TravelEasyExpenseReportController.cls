public with sharing class TravelEasyExpenseReportController {

    @AuraEnabled(cacheable=true)
    public static List<Expense_Report__c> getMyExpenseReports() {
        Id currentUserId = UserInfo.getUserId();

        return [
            SELECT Id, Name, Report_Date__c, Submission_Date__c,
                   Approval_Date__c, Status__c, Total_Amount__c,
                   Rejection_Reason__c, Employee__c, Employee__r.Name,
                   Manager__c, Manager__r.Name, Travel_Request__c,
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
            throw new AuraHandledException(
                'Please select an expense report.'
            );
        }

        // Only allow access to a report owned by the current user.
        Id currentUserId = UserInfo.getUserId();

        List<Expense_Report__c> reports = [
            SELECT Id
            FROM Expense_Report__c
            WHERE Id = :reportId
            AND Employee__c = :currentUserId
            WITH USER_MODE
            LIMIT 1
        ];

        if (reports.isEmpty()) {
            throw new AuraHandledException(
                'You cannot access this expense report.'
            );
        }

        return [
            SELECT Id, Name, Expense_Report__c, Expense_Date__c,
                   Category__c, Amount__c, Description__c,
                   Payment_Method__c, Status__c, Policy_Status__c,
                   Policy_Limit__c, Policy_Check_Notes__c,
                   Rejection_Reason__c
            FROM Expense_Item__c
            WHERE Expense_Report__c = :reportId
            WITH USER_MODE
            ORDER BY Expense_Date__c DESC
        ];
    }

    @AuraEnabled
    public static Id createExpenseItem(
        Id reportId,
        Date expenseDate,
        String category,
        Decimal amount,
        String description,
        String paymentMethod
    ) {
        if (reportId == null) {
            throw new AuraHandledException(
                'Please select an expense report.'
            );
        }

        if (expenseDate == null || String.isBlank(category)
            || amount == null || amount <= 0) {
            throw new AuraHandledException(
                'Enter an expense date, category, and amount greater than zero.'
            );
        }

        Id currentUserId = UserInfo.getUserId();

        List<Expense_Report__c> reports = [
            SELECT Id, Status__c
            FROM Expense_Report__c
            WHERE Id = :reportId
            AND Employee__c = :currentUserId
            WITH USER_MODE
            LIMIT 1
        ];

        if (reports.isEmpty()) {
            throw new AuraHandledException(
                'You cannot add expenses to this report.'
            );
        }

        if (reports[0].Status__c != 'Draft') {
            throw new AuraHandledException(
                'You can add expenses only to a Draft report.'
            );
        }

        Expense_Item__c item = new Expense_Item__c(
            Expense_Report__c = reportId,
            Expense_Date__c = expenseDate,
            Category__c = category,
            Amount__c = amount,
            Description__c = description,
            Payment_Method__c = paymentMethod,
            Status__c = 'Submitted',
            Policy_Status__c = 'Pending'
        );

        Database.insert(item, AccessLevel.USER_MODE);

        return item.Id;
    }
}

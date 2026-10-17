
public with sharing class TravelEasyExpenseItemController {
    private static Id currentUserId() {
        return UserInfo.getUserId();
    }

    private static Boolean hasAdminAccess() {
        User currentUser = [
            SELECT Profile.PermissionsModifyAllData
            FROM User
            WHERE Id = :currentUserId()
            LIMIT 1
        ];
        return currentUser.Profile.PermissionsModifyAllData;
    }

    @AuraEnabled(cacheable=true)
    public static Boolean isCurrentUserAdmin() {
        return hasAdminAccess();
    }

    private static Set<Id> accessibleReportIds() {
        Id userId = currentUserId();
        Boolean isAdmin = hasAdminAccess();
        Set<Id> reportIds = new Set<Id>();

        List<Expense_Report__c> reports;

        if (isAdmin) {
            reports = [
                SELECT Id
                FROM Expense_Report__c
                WITH USER_MODE
            ];
        } else {
            reports = [
                SELECT Id
                FROM Expense_Report__c
                WHERE Employee__c = :userId OR Manager__c = :userId
                WITH USER_MODE
            ];
        }

        for (Expense_Report__c report : reports) {
            reportIds.add(report.Id);
        }
        return reportIds;
    }

    @AuraEnabled(cacheable=true)
    public static List<Expense_Report__c> getDraftReports() {
        Id userId = currentUserId();

        if (hasAdminAccess()) {
            return [
                SELECT Id, Name, Status__c, Employee__c, Manager__c,
                       Travel_Request__c, Travel_Request__r.Name,
                       Travel_Request__r.Destination__c
                FROM Expense_Report__c
                WHERE Status__c = 'Draft'
                WITH USER_MODE
                ORDER BY Report_Date__c DESC
            ];
        }

        return [
            SELECT Id, Name, Status__c, Employee__c, Manager__c,
                   Travel_Request__c, Travel_Request__r.Name,
                   Travel_Request__r.Destination__c
            FROM Expense_Report__c
            WHERE Status__c = 'Draft'
              AND (Employee__c = :userId OR Manager__c = :userId)
            WITH USER_MODE
            ORDER BY Report_Date__c DESC
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Expense_Item__c> getExpenseItems() {
        Set<Id> reportIds = accessibleReportIds();
        if (reportIds.isEmpty()) {
            return new List<Expense_Item__c>();
        }

        return [
            SELECT Id, Name, Expense_Report__c,
                   Expense_Report__r.Name,
                   Expense_Report__r.Status__c,
                   Expense_Report__r.Employee__c,
                   Expense_Report__r.Manager__c,
                   Expense_Date__c, Category__c, Amount__c,
                   Description__c, Payment_Method__c, Status__c,
                   Policy_Status__c, Policy_Limit__c,
                   Policy_Check_Notes__c, Rejection_Reason__c
            FROM Expense_Item__c
            WHERE Expense_Report__c IN :reportIds
            WITH USER_MODE
            ORDER BY Expense_Date__c DESC, CreatedDate DESC
        ];
    }

    private static Expense_Report__c getEditableDraftReport(Id reportId) {
        if (reportId == null) {
            throw new AuraHandledException('Select an expense report.');
        }

        Id userId = currentUserId();
        List<Expense_Report__c> reports;

        if (hasAdminAccess()) {
            reports = [
                SELECT Id, Status__c
                FROM Expense_Report__c
                WHERE Id = :reportId
                WITH USER_MODE
                LIMIT 1
            ];
        } else {
            reports = [
                SELECT Id, Status__c
                FROM Expense_Report__c
                WHERE Id = :reportId
                  AND (Employee__c = :userId OR Manager__c = :userId)
                WITH USER_MODE
                LIMIT 1
            ];
        }

        if (reports.isEmpty()) {
            throw new AuraHandledException(
                'You do not have access to this expense report.'
            );
        }

        if (reports[0].Status__c != 'Draft') {
            throw new AuraHandledException(
                'Expense items can only be changed while the report is Draft.'
            );
        }

        return reports[0];
    }

    private static Expense_Item__c getEditableItem(Id itemId) {
        if (itemId == null) {
            throw new AuraHandledException('Select an expense item.');
        }

        Set<Id> reportIds = accessibleReportIds();
        List<Expense_Item__c> items = [
            SELECT Id, Expense_Report__c, Expense_Report__r.Status__c
            FROM Expense_Item__c
            WHERE Id = :itemId
              AND Expense_Report__c IN :reportIds
            WITH USER_MODE
            LIMIT 1
        ];

        if (items.isEmpty()) {
            throw new AuraHandledException(
                'You do not have access to this expense item.'
            );
        }

        if (items[0].Expense_Report__r.Status__c != 'Draft') {
            throw new AuraHandledException(
                'Expense items can only be changed while the report is Draft.'
            );
        }

        return items[0];
    }

    private static void validateExpense(
        Date expenseDate,
        String category,
        Decimal amount
    ) {
        if (expenseDate == null) {
            throw new AuraHandledException('Enter the expense date.');
        }
        if (String.isBlank(category)) {
            throw new AuraHandledException('Select an expense category.');
        }
        if (amount == null || amount <= 0) {
            throw new AuraHandledException('Amount must be greater than zero.');
        }
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
        getEditableDraftReport(reportId);
        validateExpense(expenseDate, category, amount);

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

    @AuraEnabled
    public static void updateExpenseItem(
        Id itemId,
        Date expenseDate,
        String category,
        Decimal amount,
        String description,
        String paymentMethod,
        String itemStatus
    ) {
        Expense_Item__c existingItem = getEditableItem(itemId);
        validateExpense(expenseDate, category, amount);

        existingItem.Expense_Date__c = expenseDate;
        existingItem.Category__c = category;
        existingItem.Amount__c = amount;
        existingItem.Description__c = description;
        existingItem.Payment_Method__c = paymentMethod;

        if (hasAdminAccess() && !String.isBlank(itemStatus)) {
            Set<String> validStatuses = new Set<String>{
                'Submitted', 'Under Review', 'Approved', 'Rejected'
            };
            if (!validStatuses.contains(itemStatus)) {
                throw new AuraHandledException('Invalid expense item status.');
            }
            existingItem.Status__c = itemStatus;
        }

        Database.update(existingItem, AccessLevel.USER_MODE);
    }

    @AuraEnabled
    public static void deleteExpenseItem(Id itemId) {
        Expense_Item__c existingItem = getEditableItem(itemId);
        Database.delete(existingItem, AccessLevel.USER_MODE);
    }
}

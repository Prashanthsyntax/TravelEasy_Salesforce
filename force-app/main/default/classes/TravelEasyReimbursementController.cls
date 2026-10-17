
public with sharing class TravelEasyReimbursementController {

    public class ReimbursementRow {
        @AuraEnabled public Id id { get; set; }
        @AuraEnabled public String reimbursementNumber { get; set; }
        @AuraEnabled public Id employeeId { get; set; }
        @AuraEnabled public String employeeName { get; set; }
        @AuraEnabled public Id expenseReportId { get; set; }
        @AuraEnabled public String expenseReportName { get; set; }
        @AuraEnabled public Decimal approvedAmount { get; set; }
        @AuraEnabled public Date paymentDate { get; set; }
        @AuraEnabled public String paymentMethod { get; set; }
        @AuraEnabled public String paymentReference { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public String financeRemarks { get; set; }
    }

    public class DashboardSummary {
        @AuraEnabled public Integer totalReimbursements { get; set; }
        @AuraEnabled public Integer pendingReimbursements { get; set; }
        @AuraEnabled public Integer paidReimbursements { get; set; }
        @AuraEnabled public Decimal totalApprovedAmount { get; set; }
    }

    private static final String OBJECT_API = 'Reimbursement__c';

    private static Schema.SObjectType reimbursementType() {
        Schema.SObjectType objectType =
            Schema.getGlobalDescribe().get(OBJECT_API);

        if (objectType == null) {
            throw new AuraHandledException(
                'Reimbursement__c was not found. Check the object API name.'
            );
        }

        return objectType;
    }

    @AuraEnabled(cacheable=true)
    public static List<ReimbursementRow> getReimbursements() {
        Schema.DescribeSObjectResult objectDescribe =
            reimbursementType().getDescribe();

        if (!objectDescribe.isAccessible()) {
            throw new AuraHandledException(
                'You do not have permission to view reimbursements.'
            );
        }

        List<SObject> records = Database.query(
            'SELECT Id, Name, Employee__c, Employee__r.Name, ' +
            'Expense_Report__c, Expense_Report__r.Name, ' +
            'Approved_Amount__c, Payment_Date__c, Payment_Method__c, ' +
            'Payment_Reference__c, Status__c, Finance_Remarks__c ' +
            'FROM Reimbursement__c ' +
            'WITH USER_MODE ORDER BY CreatedDate DESC LIMIT 500'
        );

        List<ReimbursementRow> results = new List<ReimbursementRow>();

        for (SObject record : records) {
            ReimbursementRow row = new ReimbursementRow();
            row.id = (Id) record.get('Id');
            row.reimbursementNumber = (String) record.get('Name');
            row.employeeId = (Id) record.get('Employee__c');
            row.expenseReportId = (Id) record.get('Expense_Report__c');
            row.approvedAmount =
                (Decimal) record.get('Approved_Amount__c');
            row.paymentDate = (Date) record.get('Payment_Date__c');
            row.paymentMethod = (String) record.get('Payment_Method__c');
            row.paymentReference =
                (String) record.get('Payment_Reference__c');
            row.status = (String) record.get('Status__c');
            row.financeRemarks = (String) record.get('Finance_Remarks__c');

            SObject employee = record.getSObject('Employee__r');
            row.employeeName = employee == null
                ? ''
                : (String) employee.get('Name');

            SObject expenseReport = record.getSObject('Expense_Report__r');
            row.expenseReportName = expenseReport == null
                ? ''
                : (String) expenseReport.get('Name');

            results.add(row);
        }

        return results;
    }

    @AuraEnabled(cacheable=true)
    public static DashboardSummary getDashboardSummary() {
        Schema.DescribeSObjectResult objectDescribe =
            reimbursementType().getDescribe();

        if (!objectDescribe.isAccessible()) {
            throw new AuraHandledException(
                'You do not have permission to view reimbursement totals.'
            );
        }

        DashboardSummary summary = new DashboardSummary();
        summary.totalReimbursements = 0;
        summary.pendingReimbursements = 0;
        summary.paidReimbursements = 0;
        summary.totalApprovedAmount = 0;

        for (AggregateResult result : [
            SELECT Status__c statusValue,
                   COUNT(Id) recordCount,
                   SUM(Approved_Amount__c) amountTotal
            FROM Reimbursement__c
            WITH USER_MODE
            GROUP BY Status__c
        ]) {
            Integer countValue = (Integer) result.get('recordCount');
            Decimal amountValue = (Decimal) result.get('amountTotal');
            String statusValue = (String) result.get('statusValue');

            summary.totalReimbursements += countValue;

            if (amountValue != null) {
                summary.totalApprovedAmount += amountValue;
            }

            if (statusValue != null &&
                statusValue.toLowerCase().contains('pending')) {
                summary.pendingReimbursements += countValue;
            }

            if (statusValue != null &&
                statusValue.equalsIgnoreCase('Paid')) {
                summary.paidReimbursements += countValue;
            }
        }

        return summary;
    }

    @AuraEnabled
    public static void updateReimbursement(
        Id reimbursementId,
        Date paymentDate,
        String paymentMethod,
        String paymentReference,
        String status,
        String financeRemarks
    ) {
        if (reimbursementId == null) {
            throw new AuraHandledException(
                'Select a reimbursement to update.'
            );
        }

        Schema.DescribeSObjectResult objectDescribe =
            reimbursementType().getDescribe();

        if (!objectDescribe.isUpdateable()) {
            throw new AuraHandledException(
                'You do not have permission to update reimbursements.'
            );
        }

        // Only update the fields submitted by the payment form.
        // USER_MODE enforces the user's object and field permissions.
        Reimbursement__c recordToUpdate = new Reimbursement__c(
            Id = reimbursementId,
            Payment_Date__c = paymentDate,
            Payment_Method__c = paymentMethod,
            Payment_Reference__c = paymentReference,
            Status__c = status,
            Finance_Remarks__c = financeRemarks
        );

        try {
            update as user recordToUpdate;
        } catch (DmlException e) {
            throw new AuraHandledException(
                'Unable to update reimbursement: ' + e.getDmlMessage(0)
            );
        }
    }
}

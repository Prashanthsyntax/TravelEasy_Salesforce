public with sharing class TravelEasyTravelRequestController {
    @AuraEnabled(cacheable=true)
    public static List<Travel_Request__c> getTravelRequests() {
        return [
            SELECT Id, Name, Destination__c, Purpose__c,
                   From_Location__c, Start_Date__c, End_Date__c,
                   Estimated_Cost__c, Status__c
            FROM Travel_Request__c
            WHERE Employee_User__c = :UserInfo.getUserId()
            WITH USER_MODE
            ORDER BY CreatedDate DESC
        ];
    }
}

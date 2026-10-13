public with sharing class TravelEasyItineraryController {

    @AuraEnabled(cacheable=true)
    public static List<Travel_Itinerary__c> getMyItineraries() {
        Id currentUserId = UserInfo.getUserId();

        return [
            SELECT Id,
                   Name,
                   Travel_Request__c,
                   Travel_Request__r.Name,
                   Travel_Request__r.Destination__c,
                   From__c,
                   To__c,
                   Travel_Date__c,
                   Departure_Time__c,
                   Arrival_Time__c,
                   Transport_Mode__c,
                   Booking_Reference__c,
                   Ticket_Cost__c,
                   Booking_Status__c
            FROM Travel_Itinerary__c
            WHERE Travel_Request__r.Employee_User__c = :currentUserId
            WITH USER_MODE
            ORDER BY Travel_Date__c DESC NULLS LAST,
                     CreatedDate DESC
        ];
    }
}
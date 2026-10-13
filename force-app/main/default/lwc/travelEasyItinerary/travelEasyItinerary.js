import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getMyItineraries from '@salesforce/apex/TravelEasyItineraryController.getMyItineraries';

const CURRENCY_FORMAT = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
});

const DATE_FORMAT = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
});

const DATETIME_FORMAT = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
});

export default class TravelEasyItinerary extends LightningElement {
    itineraries = [];
    searchTerm = '';
    statusFilter = '';
    isLoading = true;
    isFormOpen = false;
    isEditing = false;
    isViewMode = false;
    editingRecordId;
    selectedRecord;
    errorMessage;
    formError;
    wiredItinerariesResult;

    statusOptions = [
        { label: 'All booking statuses', value: '' },
        { label: 'Not Booked', value: 'Not Booked' },
        { label: 'Booked', value: 'Booked' },
        { label: 'Cancelled', value: 'Cancelled' },
        { label: 'Completed', value: 'Completed' }
    ];

    @wire(getMyItineraries)
    wiredItineraries(result) {
        this.wiredItinerariesResult = result;
        const { data, error } = result;

        if (data) {
            this.itineraries = data.map((item) => ({
                ...item,
                requestName: item.Travel_Request__r?.Name || '',
                destinationLabel: item.Travel_Request__r?.Destination__c || '',
                transportLabel: item.Transport_Mode__c || 'Not specified',
                bookingReferenceLabel: item.Booking_Reference__c || 'Not assigned',
                travelDateLabel: this.formatDate(item.Travel_Date__c),
                departureLabel: this.formatDateTime(item.Departure_Time__c),
                arrivalLabel: this.formatDateTime(item.Arrival_Time__c),
                formattedTicketCost: this.formatCurrency(item.Ticket_Cost__c),
                statusClass: this.getStatusClass(item.Booking_Status__c)
            }));

            this.errorMessage = undefined;
        } else if (error) {
            this.errorMessage =
                error.body?.message || 'Unable to load itineraries.';
            this.itineraries = [];
            // eslint-disable-next-line no-console
            console.error('TravelEasy itinerary error:', error);
        }

        this.isLoading = false;
    }

    formatDate(value) {
        if (!value) {
            return 'Not specified';
        }

        return DATE_FORMAT.format(new Date(`${value}T00:00:00`));
    }

    formatDateTime(value) {
        if (!value) {
            return 'Not specified';
        }

        return DATETIME_FORMAT.format(new Date(value));
    }

    formatCurrency(value) {
        return CURRENCY_FORMAT.format(Number(value) || 0);
    }

    getStatusClass(status) {
        const classes = {
            'Not Booked': 'status-badge status-pending',
            Booked: 'status-badge status-booked',
            Cancelled: 'status-badge status-cancelled',
            Completed: 'status-badge status-completed'
        };

        return classes[status] || 'status-badge';
    }

    get filteredItineraries() {
        const search = this.searchTerm.trim().toLowerCase();

        return this.itineraries.filter((item) => {
            const matchesStatus =
                !this.statusFilter ||
                item.Booking_Status__c === this.statusFilter;

            const searchableText = [
                item.Name,
                item.From__c,
                item.To__c,
                item.Transport_Mode__c,
                item.Booking_Reference__c,
                item.Travel_Request__r?.Name,
                item.Travel_Request__r?.Destination__c
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return matchesStatus && searchableText.includes(search);
        });
    }

    get totalItineraries() {
        return this.itineraries.length;
    }

    get bookedCount() {
        return this.itineraries.filter(
            (item) => item.Booking_Status__c === 'Booked'
        ).length;
    }

    get notBookedCount() {
        return this.itineraries.filter(
            (item) => item.Booking_Status__c === 'Not Booked'
        ).length;
    }

    get totalTicketCost() {
        return this.itineraries.reduce(
            (total, item) => total + (Number(item.Ticket_Cost__c) || 0),
            0
        );
    }

    get formattedTotalTicketCost() {
        return this.formatCurrency(this.totalTicketCost);
    }

    get hasItineraries() {
        return this.filteredItineraries.length > 0;
    }

    get showEmptyState() {
        return !this.isLoading && this.filteredItineraries.length === 0;
    }

    get emptyMessage() {
        if (this.searchTerm || this.statusFilter) {
            return 'Try changing your search or booking-status filter.';
        }

        return 'Create your first itinerary to start tracking travel bookings.';
    }

    get formTitle() {
        if (this.isViewMode) {
            return 'Itinerary details';
        }

        return this.isEditing ? 'Edit Itinerary' : 'New Itinerary';
    }

    get viewRequestName() {
        return this.selectedRecord?.requestName || 'Not specified';
    }

    get viewFrom() {
        return this.selectedRecord?.From__c || 'Not specified';
    }

    get viewTo() {
        return this.selectedRecord?.To__c || 'Not specified';
    }

    get viewTravelDate() {
        return this.selectedRecord?.travelDateLabel || 'Not specified';
    }

    get viewTransport() {
        return this.selectedRecord?.Transport_Mode__c || 'Not specified';
    }

    get viewStatus() {
        return this.selectedRecord?.Booking_Status__c || 'Not specified';
    }

    get viewDeparture() {
        return this.selectedRecord?.departureLabel || 'Not specified';
    }

    get viewArrival() {
        return this.selectedRecord?.arrivalLabel || 'Not specified';
    }

    get viewBookingReference() {
        return this.selectedRecord?.bookingReferenceLabel || 'Not assigned';
    }

    get viewTicketCost() {
        return (
            this.selectedRecord?.formattedTicketCost ||
            this.formatCurrency(0)
        );
    }

    handleSearch(event) {
        this.searchTerm = event.target.value || '';
    }

    handleStatusFilter(event) {
        this.statusFilter = event.detail.value;
    }

    async handleRefresh() {
        if (!this.wiredItinerariesResult) {
            return;
        }

        this.isLoading = true;

        try {
            await refreshApex(this.wiredItinerariesResult);
            this.errorMessage = undefined;
        } catch (error) {
            this.errorMessage =
                error.body?.message || 'Unable to refresh itineraries.';
        } finally {
            this.isLoading = false;
        }
    }

    handleNewClick() {
        this.selectedRecord = undefined;
        this.isEditing = false;
        this.isViewMode = false;
        this.editingRecordId = undefined;
        this.formError = undefined;
        this.isFormOpen = true;
    }

    handleEditClick(event) {
        const recordId = event.currentTarget.dataset.id;
        const record = this.itineraries.find(
            (item) => item.Id === recordId
        );

        if (!record) {
            return;
        }

        this.selectedRecord = record;
        this.isEditing = true;
        this.isViewMode = false;
        this.editingRecordId = recordId;
        this.formError = undefined;
        this.isFormOpen = true;
    }

    handleViewClick(event) {
        const recordId = event.currentTarget.dataset.id;
        const record = this.itineraries.find(
            (item) => item.Id === recordId
        );

        if (!record) {
            return;
        }

        this.selectedRecord = record;
        this.isEditing = false;
        this.isViewMode = true;
        this.editingRecordId = recordId;
        this.formError = undefined;
        this.isFormOpen = true;
    }

    handleSwitchToEdit() {
        this.isEditing = true;
        this.isViewMode = false;
    }

    handleCloseForm() {
        this.isFormOpen = false;
        this.editingRecordId = undefined;
        this.selectedRecord = undefined;
        this.formError = undefined;
        this.isEditing = false;
        this.isViewMode = false;
    }

    async handleSaveSuccess() {
        this.isFormOpen = false;
        this.formError = undefined;
        this.selectedRecord = undefined;
        this.isEditing = false;
        this.isViewMode = false;

        await this.handleRefresh();
    }

    handleSaveError(event) {
        this.formError =
            event.detail?.message || 'Unable to save the itinerary.';
    }
}
const { ApiResponse } = require('../../utils/apiResponse');
const { AppError } = require('../../utils/errors');

class NetworkingController {
  constructor(contactService, interactionService, reminderService, networkingService) {
    this.contactService = contactService;
    this.interactionService = interactionService;
    this.reminderService = reminderService;
    this.networkingService = networkingService;
  }

  // Contact Management Endpoints

  /**
   * List contacts
   * GET /api/contacts
   */
  async listContacts(req, res, next) {
    try {
      const userId = req.user.userId;
      const filters = {
        search: req.query.search,
        relationshipType: req.query.relationshipType,
        minStrength: req.query.minStrength ? parseInt(req.query.minStrength) : undefined,
        company: req.query.company,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder,
        limit: req.query.limit ? parseInt(req.query.limit) : 50,
        offset: req.query.offset ? parseInt(req.query.offset) : 0
      };

      const contacts = await this.contactService.listContacts(userId, filters);

      return ApiResponse.success(res, contacts, 'Contacts retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get contact details
   * GET /api/contacts/:contactId
   */
  async getContact(req, res, next) {
    try {
      const userId = req.user.userId;
      const { contactId } = req.params;

      const contact = await this.contactService.getContact(userId, contactId);

      return ApiResponse.success(res, contact, 'Contact retrieved successfully');
    } catch (error) {
      if (error.message === 'Contact not found') {
        next(new AppError('Contact not found', 404));
      } else {
        next(error);
      }
    }
  }

  /**
   * Create contact
   * POST /api/contacts
   */
  async createContact(req, res, next) {
    try {
      const userId = req.user.userId;
      const contactData = req.body;

      const result = await this.contactService.createContact(userId, contactData);

      return ApiResponse.success(res, result, 'Contact created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update contact
   * PUT /api/contacts/:contactId
   */
  async updateContact(req, res, next) {
    try {
      const userId = req.user.userId;
      const { contactId } = req.params;
      const updateData = req.body;

      const result = await this.contactService.updateContact(userId, contactId, updateData);

      return ApiResponse.success(res, result, 'Contact updated successfully');
    } catch (error) {
      if (error.message === 'Contact not found') {
        next(new AppError('Contact not found', 404));
      } else {
        next(error);
      }
    }
  }

  /**
   * Delete contact
   * DELETE /api/contacts/:contactId
   */
  async deleteContact(req, res, next) {
    try {
      const userId = req.user.userId;
      const { contactId } = req.params;

      const result = await this.contactService.deleteContact(userId, contactId);

      return ApiResponse.success(res, result, 'Contact deleted successfully');
    } catch (error) {
      if (error.message === 'Contact not found') {
        next(new AppError('Contact not found', 404));
      } else {
        next(error);
      }
    }
  }

  /**
   * Add contact tags
   * POST /api/contacts/:contactId/tags
   */
  async addContactTags(req, res, next) {
    try {
      const userId = req.user.userId;
      const { contactId } = req.params;
      const { tags } = req.body;

      // Verify ownership
      await this.contactService.getContact(userId, contactId);

      await this.contactService.addContactTags(contactId, tags);

      return ApiResponse.success(res, { success: true }, 'Tags added successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search contacts
   * GET /api/contacts/search
   */
  async searchContacts(req, res, next) {
    try {
      const userId = req.user.userId;
      const { q } = req.query;

      if (!q) {
        throw new AppError('Search query is required', 400);
      }

      const filters = { search: q, limit: 20 };
      const contacts = await this.contactService.listContacts(userId, filters);

      return ApiResponse.success(res, contacts, 'Search results retrieved');
    } catch (error) {
      next(error);
    }
  }

  // Interaction Endpoints

  /**
   * List interactions
   * GET /api/interactions
   */
  async listInteractions(req, res, next) {
    try {
      const userId = req.user.userId;
      const filters = {
        contactId: req.query.contactId,
        interactionType: req.query.interactionType,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        sentiment: req.query.sentiment,
        followUpRequired: req.query.followUpRequired === 'true',
        limit: req.query.limit ? parseInt(req.query.limit) : 50,
        offset: req.query.offset ? parseInt(req.query.offset) : 0
      };

      const interactions = await this.interactionService.listInteractions(userId, filters);

      return ApiResponse.success(res, interactions, 'Interactions retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Log interaction
   * POST /api/interactions
   */
  async logInteraction(req, res, next) {
    try {
      const userId = req.user.userId;
      const interactionData = req.body;

      const result = await this.interactionService.logInteraction(userId, interactionData);

      return ApiResponse.success(res, result, 'Interaction logged successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get interaction details
   * GET /api/interactions/:interactionId
   */
  async getInteraction(req, res, next) {
    try {
      const userId = req.user.userId;
      const { interactionId } = req.params;

      const interaction = await this.interactionService.getInteraction(userId, interactionId);

      return ApiResponse.success(res, interaction, 'Interaction retrieved successfully');
    } catch (error) {
      if (error.message === 'Interaction not found') {
        next(new AppError('Interaction not found', 404));
      } else {
        next(error);
      }
    }
  }

  /**
   * Update interaction
   * PUT /api/interactions/:interactionId
   */
  async updateInteraction(req, res, next) {
    try {
      const userId = req.user.userId;
      const { interactionId } = req.params;
      const updateData = req.body;

      const result = await this.interactionService.updateInteraction(userId, interactionId, updateData);

      return ApiResponse.success(res, result, 'Interaction updated successfully');
    } catch (error) {
      if (error.message === 'Interaction not found') {
        next(new AppError('Interaction not found', 404));
      } else {
        next(error);
      }
    }
  }

  // Meeting Notes Endpoints

  /**
   * Create meeting notes
   * POST /api/meetings
   */
  async createMeetingNotes(req, res, next) {
    try {
      const userId = req.user.userId;
      const { interactionId, ...notesData } = req.body;

      // Verify interaction ownership
      await this.interactionService.getInteraction(userId, interactionId);

      const result = await this.interactionService.createMeetingNotes(interactionId, notesData);

      return ApiResponse.success(res, result, 'Meeting notes created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update meeting notes
   * PUT /api/meetings/:meetingId
   */
  async updateMeetingNotes(req, res, next) {
    try {
      const userId = req.user.userId;
      const { meetingId } = req.params;
      const notesData = req.body;

      // Note: meetingId is actually interactionId for simplicity
      await this.interactionService.getInteraction(userId, meetingId);

      const result = await this.interactionService.updateMeetingNotes(meetingId, notesData);

      return ApiResponse.success(res, result, 'Meeting notes updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get meeting insights
   * GET /api/meetings/insights
   */
  async getMeetingInsights(req, res, next) {
    try {
      const userId = req.user.userId;
      const timeframe = req.query.timeframe ? parseInt(req.query.timeframe) : 30;

      const insights = await this.interactionService.getMeetingInsights(userId, timeframe);

      return ApiResponse.success(res, insights, 'Meeting insights retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  // Reminder Endpoints

  /**
   * List reminders
   * GET /api/reminders
   */
  async listReminders(req, res, next) {
    try {
      const userId = req.user.userId;
      const filters = {
        status: req.query.status,
        contactId: req.query.contactId,
        reminderType: req.query.reminderType,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        includeCompleted: req.query.includeCompleted === 'true',
        limit: req.query.limit ? parseInt(req.query.limit) : 50,
        offset: req.query.offset ? parseInt(req.query.offset) : 0
      };

      const reminders = await this.reminderService.listReminders(userId, filters);

      return ApiResponse.success(res, reminders, 'Reminders retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create reminder
   * POST /api/reminders
   */
  async createReminder(req, res, next) {
    try {
      const userId = req.user.userId;
      const reminderData = req.body;

      const result = await this.reminderService.createReminder(userId, reminderData);

      return ApiResponse.success(res, result, 'Reminder created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update reminder
   * PUT /api/reminders/:reminderId
   */
  async updateReminder(req, res, next) {
    try {
      const userId = req.user.userId;
      const { reminderId } = req.params;
      const updateData = req.body;

      const result = await this.reminderService.updateReminder(userId, reminderId, updateData);

      return ApiResponse.success(res, result, 'Reminder updated successfully');
    } catch (error) {
      if (error.message === 'Reminder not found') {
        next(new AppError('Reminder not found', 404));
      } else {
        next(error);
      }
    }
  }

  /**
   * Complete reminder
   * POST /api/reminders/:reminderId/complete
   */
  async completeReminder(req, res, next) {
    try {
      const userId = req.user.userId;
      const { reminderId } = req.params;

      const result = await this.reminderService.completeReminder(userId, reminderId);

      return ApiResponse.success(res, result, 'Reminder completed successfully');
    } catch (error) {
      if (error.message === 'Reminder not found') {
        next(new AppError('Reminder not found', 404));
      } else {
        next(error);
      }
    }
  }

  /**
   * Get upcoming reminders
   * GET /api/reminders/upcoming
   */
  async getUpcomingReminders(req, res, next) {
    try {
      const userId = req.user.userId;
      const days = req.query.days ? parseInt(req.query.days) : 7;

      const reminders = await this.reminderService.getUpcomingReminders(userId, days);

      return ApiResponse.success(res, reminders, 'Upcoming reminders retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  // Networking Recommendations Endpoints

  /**
   * Get networking recommendations
   * GET /api/networking/recommendations
   */
  async getRecommendations(req, res, next) {
    try {
      const userId = req.user.userId;

      const recommendations = await this.networkingService.generateRecommendations(userId);

      return ApiResponse.success(res, recommendations, 'Recommendations generated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Dismiss recommendation
   * POST /api/networking/recommendations/:recommendationId/dismiss
   */
  async dismissRecommendation(req, res, next) {
    try {
      const userId = req.user.userId;
      const { recommendationId } = req.params;

      const sql = `
        UPDATE pf_networking_recommendations 
        SET status = 'dismissed' 
        WHERE recommendation_id = ? AND user_id = ?
      `;
      
      await req.app.locals.container.databaseService.execute(sql, [recommendationId, userId]);

      return ApiResponse.success(res, { success: true }, 'Recommendation dismissed');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get networking insights
   * GET /api/networking/insights
   */
  async getNetworkingInsights(req, res, next) {
    try {
      const userId = req.user.userId;

      const insights = await this.networkingService.getNetworkingInsights(userId);

      return ApiResponse.success(res, insights, 'Networking insights retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get contact analytics
   * GET /api/contacts/analytics
   */
  async getContactAnalytics(req, res, next) {
    try {
      const userId = req.user.userId;

      const analytics = await this.contactService.getContactAnalytics(userId);

      return ApiResponse.success(res, analytics, 'Contact analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = NetworkingController;
/**
 * Unit tests for Enhanced CPA PERT Service
 * Tests the enhanced database schema with time tracking and submission features
 */

const EnhancedCpaPertService = require('../../../src/services/cpaPertServiceEnhanced');

describe('Enhanced CPA PERT Service', () => {
    let service;
    let mockDatabase;
    let mockCache;
    let mockAiService;

    beforeEach(() => {
        // Mock database
        mockDatabase = {
            executeQuery: jest.fn(),
            execute: jest.fn()
        };

        // Mock cache
        mockCache = {
            get: jest.fn(),
            set: jest.fn(),
            invalidate: jest.fn(),
            getOrSet: jest.fn((key, fn) => fn())
        };

        // Mock AI service
        mockAiService = {
            analyze: jest.fn()
        };

        service = new EnhancedCpaPertService(mockDatabase, mockCache, mockAiService);
    });

    describe('createReport', () => {
        it('should create a new PERT report with date ranges', async () => {
            const reportData = {
                user_id: 'test-user-id',
                report_period_start: '2024-01-01',
                report_period_end: '2024-06-30',
                submission_deadline: '2024-07-15',
                route_type: 'EVR',
                status: 'draft',
                employer_name: 'Test Company',
                position_title: 'Senior Accountant',
                hours_worked: 900
            };

            mockDatabase.executeQuery.mockResolvedValueOnce({ rows: [{ id: 'report-id', ...reportData }] });

            const result = await service.createReport(reportData);

            expect(mockDatabase.executeQuery).toHaveBeenCalled();
            expect(result).toHaveProperty('id');
            expect(result.route_type).toBe('EVR');
        });
    });

    describe('addExperience', () => {
        it('should add experience with start and end dates', async () => {
            const experienceData = {
                report_id: 'report-id',
                sub_competency_id: 'sub-comp-id',
                experience_title: 'Financial Analysis Project',
                experience_start_date: '2024-01-15',
                experience_end_date: '2024-02-28',
                proficiency_level: 1,
                challenge: 'Complex financial analysis required',
                actions: 'Developed comprehensive analysis model',
                results: 'Identified $500K in cost savings',
                lessons_learned: 'Importance of data validation',
                time_spent_hours: 120,
                complexity_level: 'complex',
                collaboration_type: 'team'
            };

            // Mock competency validation
            mockDatabase.executeQuery
                .mockResolvedValueOnce({ rows: [{ id: 'sub-comp-id' }] }) // validateCompetency
                .mockResolvedValueOnce({}) // insert
                .mockResolvedValueOnce({ rows: [{ id: 'exp-id', ...experienceData }] }); // select

            const result = await service.addExperience(experienceData);

            expect(mockDatabase.executeQuery).toHaveBeenCalledTimes(3);
            expect(result).toHaveProperty('id');
            expect(result.experience_start_date).toBe('2024-01-15');
            expect(result.experience_end_date).toBe('2024-02-28');
        });
    });

    describe('addExperienceBreakdown', () => {
        it('should add detailed breakdown for an experience', async () => {
            const breakdownData = {
                experience_id: 'exp-id',
                report_id: 'report-id',
                user_id: 'user-id',
                activity_type: 'analysis',
                activity_description: 'Performed variance analysis',
                start_date: '2024-01-20',
                end_date: '2024-01-25',
                hours_spent: 40,
                competencies_demonstrated: ['FR.1.1', 'MA.2.3'],
                deliverables: ['Variance Report', 'Executive Summary'],
                stakeholders_involved: ['CFO', 'Controller'],
                business_impact: 'Identified key cost drivers',
                skills_applied: ['Excel', 'Power BI', 'Financial Modeling']
            };

            mockDatabase.executeQuery
                .mockResolvedValueOnce({}) // insert
                .mockResolvedValueOnce({ rows: [{ id: 'breakdown-id', ...breakdownData }] }); // select

            const result = await service.addExperienceBreakdown(breakdownData);

            expect(mockDatabase.executeQuery).toHaveBeenCalledTimes(2);
            expect(result).toHaveProperty('id');
            expect(result.activity_type).toBe('analysis');
            expect(result.hours_spent).toBe(40);
        });
    });

    describe('recordProgressMilestone', () => {
        it('should record a competency progression milestone', async () => {
            const milestoneData = {
                user_id: 'user-id',
                sub_competency_id: 'sub-comp-id',
                milestone_date: '2024-03-01',
                previous_level: 0,
                achieved_level: 1,
                evidence_count: 5,
                hours_accumulated: 200,
                key_experiences: ['exp-1', 'exp-2', 'exp-3'],
                mentor_feedback: 'Excellent progress shown',
                self_assessment: 'Feel confident at this level',
                next_steps: 'Work towards Level 2'
            };

            mockDatabase.executeQuery
                .mockResolvedValueOnce({}) // insert milestone
                .mockResolvedValueOnce({}) // update competency progress
                .mockResolvedValueOnce({ rows: [{ id: 'milestone-id', ...milestoneData }] }); // select

            const result = await service.recordProgressMilestone(milestoneData);

            expect(mockDatabase.executeQuery).toHaveBeenCalledTimes(3);
            expect(result).toHaveProperty('id');
            expect(result.achieved_level).toBe(1);
        });
    });

    describe('submitReportToCPA', () => {
        it('should submit report with all required tracking', async () => {
            const submissionData = {
                submission_type: 'final',
                submission_deadline: '2024-07-15',
                cpa_reference_number: 'CPA-2024-001',
                exported_file_url: 'https://storage.example.com/report.pdf',
                exported_file_format: 'pdf'
            };

            // Mock getting experiences
            mockDatabase.executeQuery
                .mockResolvedValueOnce({ 
                    rows: [
                        { id: 'exp-1', word_count: 500 },
                        { id: 'exp-2', word_count: 450 },
                        { id: 'exp-3', word_count: 600 }
                    ]
                }) // getReportExperiences
                .mockResolvedValueOnce({}) // insert submission
                .mockResolvedValueOnce({}) // update report status
                .mockResolvedValueOnce({}) // add submission history
                .mockResolvedValueOnce({ 
                    rows: [{ 
                        id: 'submission-id',
                        experience_count: 3,
                        total_word_count: 1550,
                        ...submissionData 
                    }]
                }); // select submission

            const result = await service.submitReportToCPA('report-id', 'user-id', submissionData);

            expect(result).toHaveProperty('id');
            expect(result.experience_count).toBe(3);
            expect(result.total_word_count).toBe(1550);
            expect(result).toHaveProperty('submission_checksum');
        });
    });

    describe('trackExperienceTime', () => {
        it('should track daily time for an experience', async () => {
            const timeData = {
                experience_id: 'exp-id',
                user_id: 'user-id',
                activity_date: '2024-01-20',
                hours_logged: 8.5,
                activity_category: 'direct_work',
                description: 'Completed financial analysis',
                is_billable: 'Y',
                is_cpa_eligible: 'Y'
            };

            mockDatabase.executeQuery
                .mockResolvedValueOnce({}) // insert
                .mockResolvedValueOnce({ rows: [{ id: 'time-id', ...timeData }] }); // select

            const result = await service.trackExperienceTime(timeData);

            expect(mockDatabase.executeQuery).toHaveBeenCalledTimes(2);
            expect(result).toHaveProperty('id');
            expect(result.hours_logged).toBe(8.5);
            expect(result.is_cpa_eligible).toBe('Y');
        });
    });

    describe('getExperienceBreakdown', () => {
        it('should retrieve all breakdown records for an experience', async () => {
            const breakdownRecords = [
                {
                    id: 'breakdown-1',
                    activity_type: 'planning',
                    start_date: '2024-01-15',
                    end_date: '2024-01-16',
                    hours_spent: 8
                },
                {
                    id: 'breakdown-2',
                    activity_type: 'execution',
                    start_date: '2024-01-17',
                    end_date: '2024-01-25',
                    hours_spent: 64
                },
                {
                    id: 'breakdown-3',
                    activity_type: 'documentation',
                    start_date: '2024-01-26',
                    end_date: '2024-01-28',
                    hours_spent: 16
                }
            ];

            mockDatabase.executeQuery.mockResolvedValueOnce({ rows: breakdownRecords });

            const result = await service.getExperienceBreakdown('exp-id');

            expect(result).toHaveLength(3);
            expect(result[0].activity_type).toBe('planning');
            expect(result[1].activity_type).toBe('execution');
            expect(result[2].activity_type).toBe('documentation');
            
            // Verify total hours
            const totalHours = result.reduce((sum, record) => sum + record.hours_spent, 0);
            expect(totalHours).toBe(88);
        });
    });

    describe('getUserProgressTimeline', () => {
        it('should retrieve user progress milestones', async () => {
            const milestones = [
                {
                    id: 'milestone-1',
                    milestone_date: '2024-03-01',
                    achieved_level: 1,
                    hours_accumulated: 200
                },
                {
                    id: 'milestone-2',
                    milestone_date: '2024-01-15',
                    achieved_level: 0,
                    hours_accumulated: 50
                }
            ];

            mockDatabase.executeQuery.mockResolvedValueOnce({ rows: milestones });

            const result = await service.getUserProgressTimeline('user-id');

            expect(result).toHaveLength(2);
            // Should be ordered by date DESC
            expect(result[0].milestone_date).toBe('2024-03-01');
            expect(result[1].milestone_date).toBe('2024-01-15');
        });
    });
});
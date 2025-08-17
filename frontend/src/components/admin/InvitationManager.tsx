import React, { useState, useEffect, useRef } from 'react';
import invitationService, { 
  Invitation, 
  SendInvitationsRequest,
  ListInvitationsRequest,
  InvitationStats 
} from '../../services/invitationService';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorMessage } from '../common/ErrorMessage';
import { EmptyState } from '../common/EmptyState';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Alert } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

export const InvitationManager: React.FC = () => {
  // State for sending invitations
  const [emails, setEmails] = useState<string>('');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [sendingInvitations, setSendingInvitations] = useState(false);
  const [sendResults, setSendResults] = useState<{ sent: any[]; failed: any[] } | null>(null);

  // State for listing invitations
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ListInvitationsRequest>({
    status: undefined,
    page: 1,
    limit: 20,
    search: ''
  });
  const [totalPages, setTotalPages] = useState(1);

  // State for statistics
  const [stats, setStats] = useState<InvitationStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load invitations on component mount and filter changes
  useEffect(() => {
    loadInvitations();
    loadStats();
  }, [filters]);

  const loadInvitations = async () => {
    setLoadingInvitations(true);
    setInvitationError(null);
    try {
      const response = await invitationService.listInvitations(filters);
      if (response.success && response.data) {
        setInvitations(response.data.invitations);
        setTotalPages(response.data.pages);
      }
    } catch (error: any) {
      setInvitationError(error.message || 'Failed to load invitations');
    } finally {
      setLoadingInvitations(false);
    }
  };

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const response = await invitationService.getInvitationStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSendInvitations = async () => {
    const emailList = emails
      .split('\n')
      .map(email => email.trim())
      .filter(email => email && invitationService.isValidEmail(email));

    if (emailList.length === 0) {
      setInvitationError('Please enter valid email addresses');
      return;
    }

    setSendingInvitations(true);
    setSendResults(null);
    setInvitationError(null);

    try {
      const request: SendInvitationsRequest = {
        emails: emailList,
        customMessage: customMessage || undefined
      };

      const response = await invitationService.sendInvitations(request);
      if (response.success && response.data) {
        setSendResults(response.data);
        if (response.data.sent.length > 0) {
          setEmails(''); // Clear emails on success
          setCustomMessage('');
          loadInvitations(); // Refresh the list
          loadStats(); // Refresh stats
        }
      }
    } catch (error: any) {
      setInvitationError(error.message || 'Failed to send invitations');
    } finally {
      setSendingInvitations(false);
    }
  };

  const handleBulkUpload = async (file: File) => {
    try {
      const text = await file.text();
      const { emails: parsedEmails } = invitationService.parseCSV(text);
      setEmails(parsedEmails.join('\n'));
    } catch (error) {
      setInvitationError('Failed to parse CSV file');
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      const response = await invitationService.resendInvitation(invitationId);
      if (response.success) {
        loadInvitations();
      }
    } catch (error: any) {
      setInvitationError(error.message || 'Failed to resend invitation');
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to revoke this invitation?')) {
      return;
    }

    try {
      const response = await invitationService.revokeInvitation(invitationId);
      if (response.success) {
        loadInvitations();
        loadStats();
      }
    } catch (error: any) {
      setInvitationError(error.message || 'Failed to revoke invitation');
    }
  };

  const getStatusBadge = (invitation: Invitation) => {
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      expired: 'bg-gray-100 text-gray-800',
      revoked: 'bg-red-100 text-red-800'
    };

    return (
      <Badge className={statusColors[invitation.status]}>
        {invitation.status}
      </Badge>
    );
  };

  return (
    <div className="invitation-manager p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Invitation Management</h1>
        <p className="text-gray-600 mt-2">Send and manage user invitations</p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Sent</CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Accepted</CardDescription>
              <CardTitle className="text-2xl text-green-600">{stats.accepted}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-2xl text-yellow-600">{stats.pending}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Expired</CardDescription>
              <CardTitle className="text-2xl text-gray-600">{stats.expired}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Revoked</CardDescription>
              <CardTitle className="text-2xl text-red-600">{stats.declined}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Tabs defaultValue="send" className="space-y-4">
        <TabsList>
          <TabsTrigger value="send">Send Invitations</TabsTrigger>
          <TabsTrigger value="manage">Manage Invitations</TabsTrigger>
        </TabsList>

        <TabsContent value="send">
          <Card>
            <CardHeader>
              <CardTitle>Send New Invitations</CardTitle>
              <CardDescription>
                Invite users by entering their email addresses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email Input */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Email Addresses
                </label>
                <Textarea
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  placeholder="Enter email addresses, one per line"
                  rows={5}
                  className="w-full"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Enter one email address per line
                </p>
              </div>

              {/* Custom Message */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Custom Message (Optional)
                </label>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Add a personal message to the invitation"
                  rows={3}
                  className="w-full"
                />
              </div>

              {/* File Upload */}
              <div className="flex items-center space-x-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleBulkUpload(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload CSV
                </Button>
                <span className="text-sm text-gray-500">
                  Upload a CSV file with email addresses
                </span>
              </div>

              {/* Send Results */}
              {sendResults && (
                <div className="space-y-2">
                  {sendResults.sent.length > 0 && (
                    <Alert className="bg-green-50 border-green-200">
                      <p className="font-medium text-green-800">
                        Successfully sent {sendResults.sent.length} invitation(s)
                      </p>
                    </Alert>
                  )}
                  {sendResults.failed.length > 0 && (
                    <Alert className="bg-red-50 border-red-200">
                      <p className="font-medium text-red-800 mb-2">
                        Failed to send {sendResults.failed.length} invitation(s)
                      </p>
                      <ul className="text-sm text-red-700 list-disc list-inside">
                        {sendResults.failed.map((failure, index) => (
                          <li key={index}>
                            {failure.email}: {failure.reason}
                          </li>
                        ))}
                      </ul>
                    </Alert>
                  )}
                </div>
              )}

              {/* Error Message */}
              {invitationError && (
                <ErrorMessage message={invitationError} />
              )}

              {/* Send Button */}
              <Button
                onClick={handleSendInvitations}
                disabled={sendingInvitations || !emails.trim()}
                className="w-full"
              >
                {sendingInvitations ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Sending Invitations...
                  </>
                ) : (
                  'Send Invitations'
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage">
          <Card>
            <CardHeader>
              <CardTitle>Invitation History</CardTitle>
              <CardDescription>
                View and manage sent invitations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap gap-4 mb-6">
                <Input
                  placeholder="Search by email..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                  className="max-w-xs"
                />
                <select
                  value={filters.status || ''}
                  onChange={(e) => setFilters({ 
                    ...filters, 
                    status: e.target.value as any || undefined,
                    page: 1 
                  })}
                  className="px-3 py-2 border rounded-md"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="expired">Expired</option>
                  <option value="revoked">Revoked</option>
                </select>
              </div>

              {/* Invitations Table */}
              {loadingInvitations ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : invitations.length === 0 ? (
                <EmptyState
                  title="No invitations found"
                  description="Send your first invitation to get started"
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Email</th>
                        <th className="text-left py-3 px-4">Status</th>
                        <th className="text-left py-3 px-4">Invited By</th>
                        <th className="text-left py-3 px-4">Expires</th>
                        <th className="text-left py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invitations.map((invitation) => (
                        <tr key={invitation.invitationId} className="border-b">
                          <td className="py-3 px-4">{invitation.email}</td>
                          <td className="py-3 px-4">
                            {getStatusBadge(invitation)}
                          </td>
                          <td className="py-3 px-4">{invitation.inviterName}</td>
                          <td className="py-3 px-4">
                            {invitationService.formatExpirationDate(invitation.expiresAt)}
                          </td>
                          <td className="py-3 px-4">
                            {invitation.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResendInvitation(invitation.invitationId)}
                                >
                                  Resend
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleRevokeInvitation(invitation.invitationId)}
                                >
                                  Revoke
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={filters.page === 1}
                        onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                      >
                        Previous
                      </Button>
                      <span className="py-2 px-4">
                        Page {filters.page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={filters.page === totalPages}
                        onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
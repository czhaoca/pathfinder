import React, { useState, useEffect } from 'react';
import { deletionService } from '@/services/deletion.service';
import { authStore } from '@/stores/authStore';
import { CountdownTimer } from '@/components/common/CountdownTimer';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, Clock, CheckCircle, XCircle, Zap } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface DeletionRequest {
  user_id: string;
  username: string;
  email: string;
  deletion_requested_at: Date;
  deletion_scheduled_for: Date;
  deletion_type: 'user_requested' | 'admin_initiated' | 'compliance_required';
  reason?: string;
  category: string;
  status: 'pending' | 'cancelled' | 'completed';
  cancellation_token: string;
  reminder_1_sent: boolean;
  reminder_3_sent: boolean;
  reminder_6_sent: boolean;
}

export const DeletionQueueManagement: React.FC = () => {
  const { user } = authStore();
  const [queue, setQueue] = useState<DeletionRequest[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'cancelled'>('pending');
  const [loading, setLoading] = useState(true);
  
  const hasRole = (role: string) => {
    return user?.roles?.some(r => r.role_name === role) || false;
  };
  
  const isSiteAdmin = hasRole('site_admin');
  
  useEffect(() => {
    loadDeletionQueue();
    const interval = setInterval(loadDeletionQueue, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [filter]);
  
  const loadDeletionQueue = async () => {
    try {
      setLoading(true);
      const response = await deletionService.getQueue({ status: filter });
      setQueue(response);
    } catch (error) {
      toast.error('Failed to load deletion queue');
      console.error('Error loading deletion queue:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleOverride = async (userId: string, username: string) => {
    if (!isSiteAdmin) {
      toast.error('Only site admins can override cooling-off period');
      return;
    }
    
    const userInput = window.prompt(
      `This will immediately and permanently delete the user "${username}". This action cannot be undone.\n\nType "DELETE" to confirm:`
    );
    
    if (userInput !== 'DELETE') return;
    
    try {
      await deletionService.overrideCoolingOff(userId);
      toast.success('User deleted immediately');
      loadDeletionQueue();
    } catch (error: any) {
      toast.error(`Failed to override: ${error.message}`);
    }
  };
  
  const handleCancel = async (userId: string, token: string, username: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to cancel the deletion request for user "${username}"?`
    );
    
    if (!confirmed) return;
    
    try {
      await deletionService.cancelDeletion(userId, token);
      toast.success('Deletion cancelled');
      loadDeletionQueue();
    } catch (error: any) {
      toast.error(`Failed to cancel: ${error.message}`);
    }
  };
  
  const getDeletionTypeColor = (type: string) => {
    switch (type) {
      case 'user_requested':
        return 'bg-blue-100 text-blue-800';
      case 'admin_initiated':
        return 'bg-yellow-100 text-yellow-800';
      case 'compliance_required':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-gray-500" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return null;
    }
  };
  
  const pendingCount = queue.filter(q => q.status === 'pending').length;
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Deletion Queue</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage user deletion requests during the 7-day cooling-off period
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
              <span className="text-sm font-medium text-yellow-800">
                {pendingCount} pending deletion{pendingCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
      </div>
      
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {(['all', 'pending', 'cancelled'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-6 py-3 text-sm font-medium capitalize ${
                  filter === status
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {status}
                {status === 'pending' && pendingCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : queue.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No deletion requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {queue.map(request => (
                <DeletionRequestCard
                  key={request.user_id}
                  request={request}
                  onOverride={handleOverride}
                  onCancel={handleCancel}
                  canOverride={isSiteAdmin}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DeletionRequestCard: React.FC<{
  request: DeletionRequest;
  onOverride: (userId: string, username: string) => void;
  onCancel: (userId: string, token: string, username: string) => void;
  canOverride: boolean;
}> = ({ request, onOverride, onCancel, canOverride }) => {
  const isPending = request.status === 'pending';
  
  const getDeletionTypeColor = (type: string) => {
    switch (type) {
      case 'user_requested':
        return 'bg-blue-100 text-blue-800';
      case 'admin_initiated':
        return 'bg-yellow-100 text-yellow-800';
      case 'compliance_required':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  return (
    <div className={`border rounded-lg p-6 ${
      request.status === 'pending' ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-4">
          <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-lg font-medium text-gray-600">
              {request.username.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h4 className="text-lg font-medium text-gray-900">{request.username}</h4>
            <p className="text-sm text-gray-600">{request.email}</p>
            <div className="flex items-center space-x-2 mt-2">
              <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${getDeletionTypeColor(request.deletion_type)}`}>
                {request.deletion_type.replace('_', ' ')}
              </span>
              <span className="text-xs text-gray-500">
                Category: {request.category}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {request.status === 'pending' && <Clock className="h-5 w-5 text-yellow-500" />}
          {request.status === 'cancelled' && <XCircle className="h-5 w-5 text-gray-500" />}
          {request.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
          <span className={`text-sm font-medium ${
            request.status === 'pending' ? 'text-yellow-700' :
            request.status === 'cancelled' ? 'text-gray-700' : 'text-green-700'
          }`}>
            {request.status}
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500">Requested</p>
          <p className="text-sm text-gray-900">
            {format(new Date(request.deletion_requested_at), 'MMM d, yyyy h:mm a')}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Scheduled For</p>
          <p className="text-sm text-gray-900">
            {format(new Date(request.deletion_scheduled_for), 'MMM d, yyyy h:mm a')}
          </p>
        </div>
        {request.reason && (
          <div className="col-span-2">
            <p className="text-xs text-gray-500">Reason</p>
            <p className="text-sm text-gray-900">{request.reason}</p>
          </div>
        )}
      </div>
      
      {isPending && (
        <>
          <div className="bg-white rounded-lg p-4 mb-4">
            <h5 className="text-sm font-medium text-gray-700 mb-2">Time Remaining:</h5>
            <CountdownTimer 
              endTime={new Date(request.deletion_scheduled_for)}
              onComplete={() => window.location.reload()}
            />
            
            <div className="flex items-center space-x-4 mt-4">
              <span className="text-xs text-gray-500">Reminders sent:</span>
              <div className="flex items-center space-x-2">
                {request.reminder_1_sent && (
                  <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">Day 1 ✓</span>
                )}
                {request.reminder_3_sent && (
                  <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">Day 3 ✓</span>
                )}
                {request.reminder_6_sent && (
                  <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">Day 6 ✓</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-end space-x-3">
            {canOverride && (
              <button
                onClick={() => onOverride(request.user_id, request.username)}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
              >
                <Zap className="h-4 w-4 mr-2" />
                Override (Delete Now)
              </button>
            )}
            <button
              onClick={() => onCancel(request.user_id, request.cancellation_token, request.username)}
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Deletion
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default DeletionQueueManagement;
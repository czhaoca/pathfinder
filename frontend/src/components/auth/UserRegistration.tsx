import React, { useState } from 'react';
import { authService } from '@/services/authService';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { UserPlus, CheckCircle, AlertCircle, Copy, Mail, Phone, Building2, Loader2 } from 'lucide-react';

interface RegistrationResult {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    status: string;
  };
  password_retrieval_token: string;
  token_expires_at: string;
  temporary_password_expires_at: string;
}

export const UserRegistration: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    role: 'user',
    department: '',
    phone: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({});

  // Check if user has permission to register users
  const canCreateUsers = authService.hasRole('admin') || authService.hasRole('site_admin');
  const canCreateAdmins = authService.hasRole('site_admin');

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await authService.register(formData);
      setResult(response);
      
      // Reset form
      setFormData({
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        role: 'user',
        department: '',
        phone: ''
      });
    } catch (err: any) {
      setError(err.message || 'Failed to register user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopied(prev => ({ ...prev, [key]: false }));
      }, 3000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const generateRetrievalLink = () => {
    if (!result) return '';
    return `${window.location.origin}/auth/retrieve-password?token=${result.password_retrieval_token}&username=${result.user.username}`;
  };

  const handleCopyInstructions = async () => {
    if (!result) return;
    
    const instructions = `
New User Account Created
========================
Username: ${result.user.username}
Email: ${result.user.email}
Role: ${result.user.role}

Password Retrieval Link:
${generateRetrievalLink()}

Token Expires: ${new Date(result.token_expires_at).toLocaleString()}

Instructions:
1. Send the above link to the user
2. They will use it to retrieve their temporary password
3. The temporary password must be changed on first login
4. The retrieval link expires in 24 hours

Security Note: Only share this information through secure channels.
    `.trim();

    await handleCopy(instructions, 'instructions');
  };

  if (!canCreateUsers) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Unauthorized
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            You do not have permission to register users. Admin access is required.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (result) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            User Created Successfully
          </CardTitle>
          <CardDescription>
            Send the retrieval link to the new user
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <div className="ml-2">
              <p className="text-sm font-medium text-green-800">Account created successfully!</p>
              <p className="text-sm text-green-700 mt-1">
                The user must retrieve their password using the link below.
              </p>
            </div>
          </Alert>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-500">Username</Label>
                <p className="font-medium">{result.user.username}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Email</Label>
                <p className="font-medium">{result.user.email}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Role</Label>
                <Badge variant="outline">{result.user.role}</Badge>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Status</Label>
                <Badge variant="secondary">{result.user.status}</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Password Retrieval Token</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-100 rounded-md text-xs font-mono break-all">
                  {result.password_retrieval_token}
                </code>
                <Button
                  onClick={() => handleCopy(result.password_retrieval_token, 'token')}
                  variant="outline"
                  size="sm"
                >
                  {copied.token ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Expires: {new Date(result.token_expires_at).toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Password Retrieval Link</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-100 rounded-md text-xs break-all">
                  {generateRetrievalLink()}
                </code>
                <Button
                  onClick={() => handleCopy(generateRetrievalLink(), 'link')}
                  variant="outline"
                  size="sm"
                >
                  {copied.link ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <div className="ml-2">
                <p className="text-sm font-medium">Instructions for the User</p>
                <ol className="text-sm text-gray-600 mt-2 space-y-1">
                  <li>1. Click the retrieval link or use the token</li>
                  <li>2. Copy the temporary password shown</li>
                  <li>3. Login with username and temporary password</li>
                  <li>4. Create a new permanent password when prompted</li>
                </ol>
              </div>
            </Alert>
          </div>
        </CardContent>

        <CardFooter className="flex gap-2">
          <Button
            onClick={handleCopyInstructions}
            variant="outline"
            className="flex-1"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy All Instructions
          </Button>
          <Button
            onClick={() => setResult(null)}
            className="flex-1"
          >
            Register Another User
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-blue-600" />
          Register New User
        </CardTitle>
        <CardDescription>
          Create a new user account. They will receive a temporary password.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="ml-2">{error}</span>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="john_doe"
                pattern="^[a-z0-9_]{3,30}$"
                title="Lowercase letters, numbers, underscore only (3-30 chars)"
                required
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500">
                Lowercase, numbers, underscore only
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="john@example.com"
                  className="pl-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                type="text"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                placeholder="John"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                placeholder="Doe"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => handleInputChange('role', value)}
                disabled={isLoading}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  {canCreateAdmins && (
                    <SelectItem value="admin">Admin</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {!canCreateAdmins && formData.role === 'admin' && (
                <p className="text-xs text-amber-600">
                  Only site admins can create admin users
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  id="department"
                  type="text"
                  value={formData.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  placeholder="Engineering"
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <div className="ml-2">
              <p className="text-sm">
                The system will generate a secure temporary password. The user must change it on first login.
              </p>
            </div>
          </Alert>
        </CardContent>

        <CardFooter>
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !formData.username || !formData.email || !formData.firstName || !formData.lastName}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating User...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Create User
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default UserRegistration;
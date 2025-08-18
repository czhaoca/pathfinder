# LinkedIn Integration User Guide

## Overview

Pathfinder's LinkedIn integration allows you to:
- Sign in using your LinkedIn account
- Import your professional profile data
- Keep your profile synchronized with LinkedIn
- Leverage your LinkedIn network for career opportunities

This guide will walk you through setting up and using the LinkedIn integration.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Signing In with LinkedIn](#signing-in-with-linkedin)
3. [Importing Your Profile](#importing-your-profile)
4. [Profile Synchronization](#profile-synchronization)
5. [Managing Your LinkedIn Connection](#managing-your-linkedin-connection)
6. [Privacy and Security](#privacy-and-security)
7. [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites

- An active LinkedIn account
- A modern web browser (Chrome, Firefox, Safari, Edge)
- JavaScript enabled in your browser

### First-Time Setup

1. Navigate to your Pathfinder dashboard
2. Click on **Profile Settings** or **Sign In**
3. Look for the **LinkedIn** integration option
4. Follow the prompts to connect your LinkedIn account

## Signing In with LinkedIn

### For New Users

1. On the Pathfinder sign-in page, click **Sign in with LinkedIn**
2. You'll be redirected to LinkedIn's authorization page
3. Enter your LinkedIn credentials if not already logged in
4. Review the permissions requested:
   - Basic profile information
   - Email address
   - Professional profile details
5. Click **Allow** to grant access
6. You'll be redirected back to Pathfinder and automatically signed in

### For Existing Users

If you already have a Pathfinder account:

1. Sign in to your Pathfinder account
2. Go to **Settings** > **Connected Accounts**
3. Click **Link LinkedIn Account**
4. Follow the authorization process
5. If your LinkedIn email matches your Pathfinder email, you may need to enter your password to confirm the merge

## Importing Your Profile

### Initial Import

After connecting your LinkedIn account:

1. Navigate to **Profile** > **Import from LinkedIn**
2. You'll see a preview of your LinkedIn data
3. Select what to import:
   - ✅ **Work Experience**: Your employment history
   - ✅ **Education**: Academic background
   - ✅ **Skills**: Professional skills and endorsements
   - ✅ **Certifications**: Professional certifications
   - ✅ **Summary**: Professional summary/about section
   - ✅ **Profile Photo**: Your LinkedIn profile picture
   - ✅ **Location**: Current location
   - ✅ **Industry**: Professional industry

4. Click **Import Selected** to begin the import
5. Review the import summary showing what was imported

### Selective Import

For more control over what gets imported:

1. Click **Advanced Import Options**
2. You can:
   - Select individual work experiences
   - Choose specific education entries
   - Pick which skills to import
   - Select particular certifications
3. Use the checkboxes next to each item
4. Click **Import Selected Items**

### Import Tips

- **Review Before Importing**: Always preview the data before importing
- **Avoid Duplicates**: The system checks for duplicates, but review carefully
- **Edit After Import**: You can edit any imported data in Pathfinder
- **Preserve Custom Data**: Importing won't overwrite your custom entries

## Profile Synchronization

### Automatic Sync

Keep your Pathfinder profile updated with LinkedIn changes:

1. Go to **Settings** > **LinkedIn Sync**
2. Toggle **Auto-Sync** to enable
3. Choose sync frequency:
   - Hourly
   - Every 6 hours
   - Daily (recommended)
   - Weekly
   - Monthly

### Manual Sync

To sync immediately:

1. Go to **Profile** > **Sync with LinkedIn**
2. Click **Sync Now**
3. Review the changes that will be applied
4. Confirm to proceed

### Sync Settings

Configure what gets synchronized:

- **New Positions**: Automatically add new work experiences
- **Updated Information**: Update existing entries
- **Skills**: Add new skills from LinkedIn
- **Profile Photo**: Keep photo synchronized

### Sync History

View your sync history:

1. Go to **Settings** > **LinkedIn Sync** > **History**
2. See:
   - Last sync date and time
   - Changes made during each sync
   - Any sync errors or issues

## Managing Your LinkedIn Connection

### Viewing Connection Status

Check your LinkedIn connection:

1. Go to **Settings** > **Connected Accounts**
2. Find LinkedIn in the list
3. View:
   - Connection status (Active/Inactive)
   - Last sync date
   - Linked email address

### Updating Permissions

If LinkedIn permissions change:

1. You may need to reauthorize
2. Click **Update Permissions** when prompted
3. Review and accept new permissions

### Unlinking Your Account

To disconnect LinkedIn:

1. Go to **Settings** > **Connected Accounts**
2. Find LinkedIn and click **Unlink**
3. Confirm the action
4. Note: You won't lose imported data

**Important**: You can only unlink if you have another way to sign in (password or another OAuth provider).

## Privacy and Security

### Data We Access

When you connect LinkedIn, we access:
- Public profile information
- Work experience
- Education history
- Skills and endorsements
- Certifications
- Profile photo

### Data We DON'T Access

We never access:
- Your LinkedIn connections/network
- Private messages
- Posts or activity
- Recommendations
- LinkedIn password

### Data Storage

- All imported data is encrypted
- Data is stored in your personal Pathfinder profile
- You maintain full control over your data
- You can delete imported data at any time

### Security Measures

- OAuth 2.0 with PKCE for secure authentication
- Encrypted token storage
- Regular security audits
- No password sharing between services

## Troubleshooting

### Common Issues

#### "LinkedIn Sign-In Not Working"

1. Clear your browser cache and cookies
2. Ensure JavaScript is enabled
3. Try a different browser
4. Check if LinkedIn is accessible

#### "Import Failed"

1. Check your LinkedIn privacy settings
2. Ensure your profile is not restricted
3. Try importing fewer items at once
4. Contact support if the issue persists

#### "Sync Not Working"

1. Verify LinkedIn connection is active
2. Check sync settings are enabled
3. Manually trigger a sync
4. Re-authorize if tokens expired

#### "Duplicate Data After Import"

1. Use the duplicate resolver tool
2. Manually review and merge entries
3. Adjust import settings for future imports

### Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| "LinkedIn OAuth is not enabled" | Feature is disabled | Contact your administrator |
| "Account exists with this email" | Email already registered | Use password to merge accounts |
| "No refresh token available" | Authentication expired | Re-connect LinkedIn account |
| "Rate limit exceeded" | Too many requests | Wait and try again later |

### Getting Help

If you need assistance:

1. Check the [FAQ section](#frequently-asked-questions)
2. Contact support at support@pathfinder.com
3. Visit our community forum
4. Use in-app chat support

## Frequently Asked Questions

### Can I use LinkedIn to sign in on mobile?

Yes! The LinkedIn sign-in works on:
- iOS devices (iPhone, iPad)
- Android devices
- Mobile web browsers

### Will importing overwrite my existing data?

No, importing creates new entries. You can:
- Review before importing
- Merge duplicate entries
- Keep both versions if desired

### How often should I sync?

We recommend:
- **Active job seekers**: Daily
- **Passive candidates**: Weekly
- **Employed professionals**: Monthly

### Can I import from multiple LinkedIn accounts?

No, you can only link one LinkedIn account at a time. To switch accounts:
1. Unlink current account
2. Link new account
3. Import from new account

### Is my LinkedIn password stored?

No, we never store or have access to your LinkedIn password. We use OAuth tokens for secure access.

### What happens if I delete my LinkedIn account?

- You'll still have access to imported data
- Sync will stop working
- You can still sign in if you have a password set

### Can I edit imported data?

Yes! All imported data can be edited:
1. Go to your profile
2. Click edit on any section
3. Make your changes
4. Save

### Will my LinkedIn connections see I'm using Pathfinder?

No, using Pathfinder with LinkedIn:
- Doesn't post to your timeline
- Doesn't notify your connections
- Doesn't change your LinkedIn profile

## Best Practices

### For Job Seekers

1. **Import Everything**: Start with a complete import
2. **Enhance in Pathfinder**: Add details LinkedIn doesn't capture
3. **Regular Syncs**: Keep data current with weekly syncs
4. **Leverage Both**: Use LinkedIn for networking, Pathfinder for applications

### For Career Development

1. **Track Progress**: Import periodically to track career growth
2. **Skill Analysis**: Compare LinkedIn skills with job requirements
3. **Gap Identification**: Identify missing skills or experiences
4. **Goal Setting**: Use imported data as baseline for goals

### For Profile Optimization

1. **A/B Testing**: Test different profiles on LinkedIn vs Pathfinder
2. **Keyword Optimization**: Enhance imported content with keywords
3. **Quantify Achievements**: Add metrics to imported experiences
4. **Tailored Versions**: Create role-specific versions in Pathfinder

## Mobile App Integration

### iOS Setup

1. Download Pathfinder from App Store
2. Open the app and tap **Sign In**
3. Choose **Continue with LinkedIn**
4. Authenticate in the in-app browser
5. Grant permissions
6. You're signed in!

### Android Setup

1. Download Pathfinder from Google Play
2. Open the app and tap **Sign In**
3. Select **LinkedIn Sign-In**
4. Authenticate via Chrome Custom Tab
5. Allow requested permissions
6. Start using Pathfinder!

### Mobile-Specific Features

- **Quick Sync**: Pull-to-refresh for instant sync
- **Offline Access**: View imported data offline
- **Push Notifications**: Get notified of sync completions
- **Biometric Login**: Use Face ID/Touch ID after initial setup

## Advanced Features

### API Access

For developers and power users:

1. Generate API key in settings
2. Use LinkedIn data via Pathfinder API
3. Automate profile updates
4. Build custom integrations

### Bulk Operations

For recruiters and teams:

1. Import multiple profiles (with consent)
2. Bulk sync team members
3. Export aggregated data
4. Generate team skill matrices

### Analytics

Track your LinkedIn integration usage:

1. View import statistics
2. Monitor sync performance
3. Analyze profile completeness
4. Track engagement metrics

## Next Steps

Now that you're connected:

1. ✅ Complete your profile import
2. ✅ Set up automatic sync
3. ✅ Enhance imported data with additional details
4. ✅ Create tailored resumes from your LinkedIn data
5. ✅ Set up job alerts based on your profile

---

*Last updated: January 2024*
*Version: 1.0*

**Need more help?** Contact our support team or visit our [Help Center](https://help.pathfinder.com).
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SettingsLayout } from '@/app/layouts/SettingsLayout';
import { Input, Textarea, Select } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { Avatar } from '@/shared/ui/Containers';
import { SettingsSkeleton } from '@/shared/ui/Feedback';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Section } from '@/shared/ui/Section';
import { useWorkspaceSettings } from '@/features/settings';
import { ProfileSchema, WorkspaceSettingsSchema } from '@/shared/validation/schemas';
import { AuthService, useAuth } from '@/features/auth';
import { exportWorkspaceJson } from '@/shared/utils/csvExport';
import { supabase } from '@/shared/lib/supabaseClient';
import { Database, HardDriveDownload } from 'lucide-react';

interface SettingsTemplateProps {
  workspaceId: string;
  profileId: string;
  addToast: (type: 'success' | 'info' | 'warning' | 'error', message: string, desc?: string) => void;
  activeTab: string;
}

export const SettingsTemplate: React.FC<SettingsTemplateProps> = ({
  workspaceId,
  profileId,
  addToast,
  activeTab,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  
  const handleTabChange = (tabId: string) => {
    navigate(`/settings/${tabId}`);
  };

  const { profile, settings, isLoading, updateProfile, updateSettings } = useWorkspaceSettings(workspaceId, profileId);
  
  // Profile state
  const [fullName, setFullName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');

  // Security states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Workspace Settings state
  const [companyName, setCompanyName] = useState('');
  const [gstin, setGstin] = useState('');
  const [gstType, setGstType] = useState('regular');
  const [bankName, setBankName] = useState('');
  const [bankAcc, setBankAcc] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [upiVpa, setUpiVpa] = useState('');
  const [address, setAddress] = useState('');
  const [lutNumber, setLutNumber] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || '');
      setProfileEmail(profile.email || user?.email || '');
    } else if (user) {
      setFullName(user.user_metadata?.full_name || user.email?.split('@')[0] || '');
      setProfileEmail(user.email || '');
    }
  }, [profile, user]);

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.company_name || '');
      setGstin(settings.gstin || '');
      setBankName(settings.bank_name || '');
      setBankAcc(settings.bank_account_no || '');
      setBankIfsc(settings.bank_ifsc || '');
      setUpiVpa(settings.upi_id || '');
      setAddress(settings.address || '');
      setProfilePhone(settings.phone || '');
      setLutNumber(settings.lut_number || '');
      const scheme = settings.tax_scheme || (settings.is_gst_registered ? 'regular' : 'non_gst');
      setGstType(scheme === 'non_gst' ? 'unregistered' : scheme);
    }
  }, [settings]);

  const saveProfile = async () => {
    try {
      setSaving(true);
      
      const validated = ProfileSchema.pick({ full_name: true, email: true }).parse({
        full_name: fullName.trim() || undefined,
        email: profileEmail.trim(),
      });
      
      await updateProfile({
        full_name: validated.full_name ?? null,
        email: validated.email,
      });

      if (user?.email && validated.email && validated.email.toLowerCase() !== user.email.toLowerCase()) {
        const authRes = await AuthService.updateEmail(validated.email);
        if (!authRes.success) {
          addToast('warning', 'Email Confirmation Required', 'A verification link was sent to your new email address to complete the change.');
        } else {
          addToast('success', 'Profile & Email Updated', 'Your profile details and primary email have been updated.');
        }
      } else {
        addToast('success', 'Profile Updated Successfully', 'Your profile details have been saved.');
      }
    } catch (e: any) {
      addToast('error', 'Profile Update Failed', e.message || 'Validation failed');
    } finally {
      setSaving(false);
    }
  };

  const saveBanking = async () => {
    try {
      setSaving(true);
      
      const validated = WorkspaceSettingsSchema.parse({
        company_name: companyName || null,
        bank_name: bankName || null,
        bank_account_no: bankAcc || null,
        bank_ifsc: bankIfsc || null,
        upi_id: upiVpa || null,
      });
      
      await updateSettings({
        bank_name: validated.bank_name ?? null,
        bank_account_no: validated.bank_account_no ?? null,
        bank_ifsc: validated.bank_ifsc ?? null,
        upi_id: validated.upi_id ?? null,
        company_name: validated.company_name ?? null,
      });
      addToast('success', 'Banking & UPI Info Saved');
    } catch (e: any) {
      addToast('error', 'Banking Update Failed', e.message || 'Validation failed');
    } finally {
      setSaving(false);
    }
  };

  const saveGst = async () => {
    try {
      setSaving(true);
      
      const taxScheme = gstType === 'composition' ? 'composition' : gstType === 'unregistered' ? 'non_gst' : 'regular';
      const validated = WorkspaceSettingsSchema.parse({
        gstin: gstin || null,
        address: address || null,
        phone: profilePhone || null,
        is_gst_registered: gstType !== 'unregistered',
        tax_scheme: taxScheme,
        lut_number: lutNumber || null,
      });
      
      await updateSettings({
        gstin: validated.gstin ?? null,
        address: validated.address ?? null,
        phone: validated.phone ?? null,
        is_gst_registered: validated.is_gst_registered ?? false,
        tax_scheme: validated.tax_scheme,
        lut_number: validated.lut_number ?? null,
      });
      addToast('success', 'Tax & Branding Settings Saved');
    } catch (e: any) {
      addToast('error', 'Failed to Save GST Settings', e.message || 'Validation failed');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!newPassword) {
      addToast('warning', 'Validation Error', 'Password cannot be empty.');
      return;
    }
    if (newPassword.length < 12) {
      addToast('warning', 'Weak Password', 'Password must be at least 12 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('warning', 'Mismatch', 'New passwords do not match.');
      return;
    }

    try {
      setSaving(true);
      const res = await AuthService.updatePassword(newPassword);
      if (!res.success) throw res.error;
      addToast('success', 'Password Updated', 'Your account credentials were successfully updated.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      addToast('error', 'Failed to Update Password', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportWorkspace = async () => {
    try {
      setExportingData(true);
      const [clientsRes, projectsRes, invoicesRes, paymentsRes] = await Promise.all([
        supabase.from('clients').select('*').eq('workspace_id', workspaceId),
        supabase.from('projects').select('*').eq('workspace_id', workspaceId),
        supabase.from('invoices').select('*').eq('workspace_id', workspaceId),
        supabase.from('payments').select('*').eq('workspace_id', workspaceId),
      ]);

      const backup = {
        ujrat_schema_version: '1.0',
        exported_at: new Date().toISOString(),
        workspace_id: workspaceId,
        profile: profile,
        settings: settings,
        clients: clientsRes.data || [],
        projects: projectsRes.data || [],
        invoices: invoicesRes.data || [],
        payments: paymentsRes.data || [],
      };

      exportWorkspaceJson(backup, `ujrat_backup_${new Date().toISOString().slice(0, 10)}.json`);
      addToast('success', 'Data Backup Exported', `Downloaded complete workspace archive.`);
    } catch (err: any) {
      addToast('error', 'Backup Failed', err.message);
    } finally {
      setExportingData(false);
    }
  };

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="space-y-6.5 animate-slide-up">
      <PageHeader
        title="Settings"
        description="Configure your registered profile details, UPI settings, bank accounts, and GST compliance parameters."
      />

      <SettingsLayout activeTab={activeTab} onTabChange={handleTabChange}>
        {activeTab === 'profile' && (
          <Section title="Profile Details" description="This information will appear on client proposals and agreements.">
            <div className="space-y-6 pt-1">
              <div className="flex items-center gap-4 border border-border p-4 rounded-lg bg-surface/30">
                <Avatar name={fullName || 'Freelancer'} size="xl" />
                <div className="min-w-0">
                  <p className="text-small font-bold text-foreground m-0">{fullName || 'Freelancer'}</p>
                  <p className="text-[11px] text-muted-foreground m-0 font-medium">{profileEmail || 'No email configured'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input 
                  label="Display Full Name" 
                  placeholder="e.g. Mohammed Rayyan"
                  value={fullName} 
                  onChange={e => setFullName(e.target.value)} 
                />
                <Input 
                  label="Primary Account Email" 
                  type="email" 
                  placeholder="you@example.com"
                  value={profileEmail} 
                  onChange={e => setProfileEmail(e.target.value)}
                  hint="Used for authentication, notifications, and client communication." 
                />
              </div>
              <div className="flex justify-end pt-2 border-t border-border mt-4">
                <Button variant="primary" onClick={saveProfile} loading={saving}>Save Changes</Button>
              </div>
            </div>
          </Section>
        )}

        {activeTab === 'banking' && (
          <Section title="UPI & Banking Coordinates" description="Used to generate scan-to-pay UPI QR codes on milestone compliance invoices.">
            <div className="space-y-5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="UPI ID / Virtual Payment Address *" placeholder="e.g. name@okhdfcbank" value={upiVpa} onChange={e => setUpiVpa(e.target.value)} />
                <Input label="Billing Business Name *" placeholder="Rohan Sharma Designs" value={companyName} onChange={e => setCompanyName(e.target.value)} />
                <Input label="Official Bank Name" placeholder="e.g. HDFC Bank" value={bankName} onChange={e => setBankName(e.target.value)} />
                <Input label="Account Number" placeholder="e.g. 50100481..." value={bankAcc} onChange={e => setBankAcc(e.target.value)} />
                <Input label="Bank IFSC Code" placeholder="e.g. HDFC0000123" value={bankIfsc} onChange={e => setBankIfsc(e.target.value)} />
              </div>
              <div className="flex justify-end pt-2 border-t border-border mt-4">
                <Button variant="primary" onClick={saveBanking} loading={saving}>Save Banking Info</Button>
              </div>
            </div>
          </Section>
        )}

        {activeTab === 'branding' && (
          <Section title="Branding & GST Payouts" description="Registered tax identification, LUT declarations, and TDS parameters embedded on PDF invoices.">
            <div className="space-y-5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="GSTIN (Tax Identification Number)" placeholder="29AAAAA1111A1Z1" value={gstin} onChange={e => setGstin(e.target.value)} />
                <Select label="GST Tax Scheme" options={[
                  { value: 'regular', label: 'Regular Scheme (18% / 12% / 5%)' },
                  { value: 'composition', label: 'Composition Scheme (Section 10)' },
                  { value: 'unregistered', label: 'Non-GST Registered Freelancer' },
                ]} value={gstType} onChange={e => setGstType(e.target.value)} />
                <Input label="LUT Number (For Zero-Rated Exports)" placeholder="e.g. AD290324000123L" value={lutNumber} onChange={e => setLutNumber(e.target.value)} hint="Required for zero-rated foreign export invoices" />
                <Input label="Office Phone Number" placeholder="e.g. 9876543210" value={profilePhone} onChange={e => setProfilePhone(e.target.value)} />
              </div>
              <Textarea label="Registered Office Address" placeholder="Street name, landmark, City, State, PIN code" value={address} onChange={e => setAddress(e.target.value)} />
              <div className="flex justify-end pt-2 border-t border-border mt-4">
                <Button variant="primary" onClick={saveGst} loading={saving}>Save GST Settings</Button>
              </div>
            </div>
          </Section>
        )}

        {activeTab === 'security' && (
          <Section title="Security & Authentication" description="Manage your workspace password and security credentials.">
            <div className="space-y-5 pt-1 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input 
                  label="New Password" 
                  type="password" 
                  placeholder="At least 12 characters" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                />
                <Input 
                  label="Confirm New Password" 
                  type="password" 
                  placeholder="Repeat new password" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                />
              </div>
              <div className="flex justify-end pt-2 border-t border-border mt-4">
                <Button variant="primary" onClick={changePassword} loading={saving}>Update Password</Button>
              </div>
            </div>
          </Section>
        )}

        {activeTab === 'data' && (
          <Section title="Data Portability & Workspace Backup" description="Export and own all your workspace records in standard open formats.">
            <div className="space-y-5 pt-1 animate-fade-in">
              <div className="p-4.5 border border-border bg-surface/30 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-foreground font-semibold text-small">
                  <Database className="h-4.5 w-4.5 text-primary" />
                  <span>Full Workspace Archive (JSON)</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed m-0">
                  Export all your client records, project scopes, issued GST invoices, and transaction payment entries.
                  This archive is fully portable and can be used for local backups or auditing.
                </p>
                <div className="pt-2">
                  <Button
                    variant="primary"
                    onClick={handleExportWorkspace}
                    loading={exportingData}
                    icon={<HardDriveDownload className="h-4 w-4" />}
                  >
                    Download Full Workspace Backup (.json)
                  </Button>
                </div>
              </div>
            </div>
          </Section>
        )}
      </SettingsLayout>
    </div>
  );
};

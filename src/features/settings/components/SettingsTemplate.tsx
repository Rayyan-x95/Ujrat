import React, { useState, useEffect } from 'react';
import { SettingsLayout } from '@/app/layouts/SettingsLayout';
import { Input, Textarea, Select } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { Avatar } from '@/shared/ui/Containers';
import { SettingsSkeleton } from '@/shared/ui/Feedback';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Section } from '@/shared/ui/Section';
import { useWorkspaceSettings } from '@/features/settings';
import { ProfileSchema, WorkspaceSettingsSchema } from '@/shared/validation/schemas';
import { AuthService } from '@/features/auth';

interface SettingsTemplateProps {
  workspaceId: string;
  profileId: string;
  addToast: (type: 'success' | 'info' | 'warning' | 'error', message: string, desc?: string) => void;
}

export const SettingsTemplate: React.FC<SettingsTemplateProps> = ({
  workspaceId,
  profileId,
  addToast,
}) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setProfileEmail(profile.email || '');
    }
  }, [profile]);

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
    }
  }, [settings]);

  const saveProfile = async () => {
    try {
      setSaving(true);
      
      const validated = ProfileSchema.pick({ full_name: true }).parse({
        full_name: fullName,
      });
      
      await updateProfile({
        full_name: validated.full_name ?? null,
      });
      addToast('success', 'Profile Updated Successfully');
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
        bank_name: validated.bank_name,
        bank_account_no: validated.bank_account_no,
        bank_ifsc: validated.bank_ifsc,
        upi_id: validated.upi_id,
        company_name: validated.company_name,
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
      
      const validated = WorkspaceSettingsSchema.parse({
        gstin: gstin || null,
        address: address || null,
        phone: profilePhone || null,
      });
      
      await updateSettings({
        gstin: validated.gstin ?? null,
        address: validated.address ?? null,
        phone: validated.phone ?? null,
      });
      addToast('success', 'Branding & GST Info Saved');
    } catch (e: any) {
      addToast('error', 'GST Update Failed', e.message || 'Validation failed');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!newPassword.trim()) {
      addToast('warning', 'Validation Error', 'Password cannot be empty.');
      return;
    }
    if (newPassword.length < 6) {
      addToast('warning', 'Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('warning', 'Password Mismatch', 'Passwords do not match.');
      return;
    }

    try {
      setSaving(true);
      const res = await AuthService.updatePassword(newPassword);
      if (res.success) {
        addToast('success', 'Password Updated Successfully', 'Your account credentials have been updated.');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        throw res.error;
      }
    } catch (e: any) {
      addToast('error', 'Failed to Update Password', e.message);
    } finally {
      setSaving(false);
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

      <SettingsLayout activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'profile' && (
          <Section title="Profile Details" description="This information will appear on client proposals and agreements.">
            <div className="space-y-6 pt-1">
              <div className="flex items-center gap-4 border border-border p-4 rounded-lg bg-surface/30">
                <Avatar name={fullName} size="xl" />
                <div className="min-w-0">
                  <p className="text-small font-bold text-foreground m-0">{fullName || 'Freelancer'}</p>
                  <p className="text-[11px] text-muted-foreground m-0 font-medium">{profileEmail}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Display Full Name" value={fullName} onChange={e => setFullName(e.target.value)} />
                <Input 
                  label="Primary Account Email" 
                  type="email" 
                  value={profileEmail} 
                  readOnly={true} 
                  hint="Primary email address is managed via account authentication." 
                  onChange={e => setProfileEmail(e.target.value)} 
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
          <Section title="Branding & GST Payouts" description="Registered tax identification parameters embedded on PDF downloads.">
            <div className="space-y-5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="GSTIN (Tax Identification Number)" placeholder="22AAAAA0000A1Z5" value={gstin} onChange={e => setGstin(e.target.value)} />
                <Select label="GST Registration Type" options={[
                  { value: 'regular', label: 'Regular Scheme' },
                  { value: 'composition', label: 'Composition Scheme' },
                  { value: 'unregistered', label: 'Unregistered Freelancer' },
                ]} value={gstType} onChange={e => setGstType(e.target.value)} />
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
                  placeholder="At least 6 characters" 
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
      </SettingsLayout>
    </div>
  );
};

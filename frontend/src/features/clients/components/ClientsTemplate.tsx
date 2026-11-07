import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@/shared/ui/Table';
import Table from '@/shared/ui/Table';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Containers';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { Input, Textarea } from '@/shared/ui/Input';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useClients } from '@/features/clients';
import type { Client } from '@/shared/types';
import { Plus, Mail, Building, Phone, Archive, Users, Pencil } from 'lucide-react';

interface ClientsTemplateProps {
  workspaceId: string;
  profileId: string;
  addToast: (type: 'success' | 'info' | 'warning' | 'error', message: string, desc?: string) => void;
}

export const ClientsTemplate: React.FC<ClientsTemplateProps> = ({
  workspaceId,
  profileId,
  addToast,
}) => {
  const { clients, isLoading, addClient, editClient, removeClient } = useClients(workspaceId, profileId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAdd, setShowAdd] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [clientToArchive, setClientToArchive] = useState<Client | null>(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowAdd(true);
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // New Client Form States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      if (!name.trim()) setNameError('Name is required.');
      if (!email.trim()) setEmailError('Email is required.');
      addToast('warning', 'Validation Warning', 'Name and Email are required.');
      return;
    }
    setNameError('');
    setEmailError('');
    try {
      setSubmitting(true);
      const payload = {
        name: name.trim(),
        email: email.trim(),
        company: company || null,
        phone: phone || null,
        whatsapp: whatsapp || null,
        address: address || null,
        notes: notes || null,
        status: 'active' as const,
        gstin: null,
        state: null,
      };
      if (clientToEdit) {
        await editClient({ id: clientToEdit.id, ...payload });
        addToast('success', 'Client Updated', `${name.trim()} has been updated.`);
        setClientToEdit(null);
      } else {
        await addClient(payload);
        addToast('success', 'Client Added Successfully', `${name.trim()} has been added to your contacts.`);
      }
      setShowAdd(false);
      
      // Reset fields
      setName('');
      setEmail('');
      setCompany('');
      setPhone('');
      setWhatsapp('');
      setAddress('');
      setNotes('');
    } catch (e: any) {
      console.error('[ClientsTemplate] Add client failed:', e?.message || e);
      addToast('error', 'Add Client Failed', e?.message || 'Failed to add client');
    } finally {
      setSubmitting(false);
    }
  };

  const startEditClient = (client: Client) => {
    setClientToEdit(client);
    setName(client.name || '');
    setEmail(client.email || '');
    setCompany(client.company || '');
    setPhone(client.phone || '');
    setWhatsapp(client.whatsapp || '');
    setAddress(client.address || '');
    setNotes(client.notes || '');
    setShowAdd(true);
  };

  const confirmArchive = async () => {
    if (!clientToArchive) return;
    try {
      setArchiving(true);
      await removeClient(clientToArchive.id);
      addToast('info', 'Client Archived', `${clientToArchive.name} has been archived.`);
      setClientToArchive(null);
    } catch (e) {
      addToast('error', 'Archive Failed', (e as Error).message);
    } finally {
      setArchiving(false);
    }
  };

  const columns: ColumnDef<Client>[] = React.useMemo(() => [
    {
      key: 'name', 
      header: 'Client Details', 
      sortable: true,
      render: row => (
        <div className="flex items-center gap-3 py-0.5">
          <Avatar name={row.name} size="sm" />
          <div className="min-w-0">
            <p className="text-small font-semibold text-foreground m-0">{row.name}</p>
            <p className="text-[10px] text-muted-foreground m-0 flex items-center gap-1 mt-0.5">
              <Mail className="h-2.5 w-2.5 shrink-0 text-muted-foreground/60" />
              <span className="truncate">{row.email}</span>
            </p>
          </div>
        </div>
      ),
    },
    { 
      key: 'company', 
      header: 'Company / Organization', 
      sortable: true, 
      render: row => (
        <span className="text-foreground/80 flex items-center gap-1.5 font-medium">
          <Building className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          <span>{row.company || '—'}</span>
        </span>
      ) 
    },
    {
      key: 'phone', 
      header: 'Contact Info',
      render: row => {
        const contactNum = row.whatsapp || row.phone;
        if (!contactNum) {
          return <span className="text-muted-foreground">—</span>;
        }
        const isWa = Boolean(row.whatsapp);
        const cleanNum = contactNum.replace(/[^0-9]/g, '');
        const href = isWa ? `https://wa.me/${cleanNum}` : `tel:${contactNum.replace(/[^0-9+]/g, '')}`;
        return (
          <a
            href={href}
            target={isWa ? '_blank' : undefined}
            rel={isWa ? 'noopener noreferrer' : undefined}
            className="text-muted-foreground hover:text-primary flex items-center gap-1.5 transition-colors group cursor-pointer"
            title={isWa ? 'Chat on WhatsApp' : 'Call contact'}
          >
            <Phone className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary shrink-0 transition-colors" />
            <span className="group-hover:underline">{contactNum}</span>
          </a>
        );
      },
    },
    {
      key: 'status', 
      header: 'Status', 
      align: 'center',
      render: row => <Badge variant={row.status === 'active' ? 'success' : 'outline'} dot size="sm">{row.status}</Badge>,
    },
    {
      key: 'actions', 
      header: 'Actions', 
      align: 'right',
      render: row => (
        <div className="flex gap-1.5 justify-end">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => startEditClient(row)}
            className="text-muted-foreground hover:text-foreground hover:bg-surface/50"
            icon={<Pencil className="h-3.5 w-3.5" />}
          >
            Edit
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setClientToArchive(row)}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/5"
            icon={<Archive className="h-3.5 w-3.5" />}
          >
            Archive
          </Button>
        </div>
      ),
    },
  ], []);

  return (
    <div className="space-y-6.5 animate-slide-up">
      <PageHeader
        title="Clients"
        description={isLoading ? 'Loading relationships...' : `${clients.length} registered client${clients.length === 1 ? '' : 's'} in your workspace`}
        actions={
          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => setShowAdd(true)}
            icon={<Plus className="h-4 w-4" />}
          >
            Add Client
          </Button>
        }
      />

      <Table<Client>
        columns={columns}
        data={clients}
        keyField="id"
        searchable
        searchPlaceholder="Search clients by name or company..."
        emptyState={{
          icon: <Users className="h-5 w-5" />,
          title: "No Clients Registered Yet",
          description: "Add your first client contact to start drafting proposals, executing contracts, and issuing GST invoices.",
          action: (
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => setShowAdd(true)} 
              icon={<Plus className="h-4 w-4" />}
            >
              Add First Client
            </Button>
          ),
          tips: [
            "Adding client WhatsApp numbers enables 1-click invoice sharing.",
            "Client billing addresses and region details automatically populate into invoices.",
            "Each client gets a secure, passwordless portal link to sign agreements."
          ]
        }}
        loading={isLoading}
      />

      {/* Confirmation Dialog for Archiving Client */}
      <Dialog 
        open={!!clientToArchive} 
        onClose={() => setClientToArchive(null)} 
        title="Archive Client Account"
        size="sm"
      >
        <div className="space-y-4 pt-1">
          <p className="text-small text-muted-foreground leading-relaxed">
            Are you sure you want to archive <strong className="text-foreground">{clientToArchive?.name}</strong>? Existing projects and invoices will remain intact.
          </p>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" size="sm" onClick={() => setClientToArchive(null)} type="button">
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={confirmArchive} loading={archiving}>
              Archive Client
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Add / Edit Client Dialog */}
      <Dialog open={showAdd} onClose={() => { setShowAdd(false); setClientToEdit(null); }} title={clientToEdit ? 'Edit Client' : 'Register New Client'} size="md">
        <form onSubmit={handleAddClient} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Full Name" placeholder="Arjun Mehta" value={name} onChange={e => { setName(e.target.value); setNameError(''); }} error={nameError} required />
            <Input label="Email Address" type="email" placeholder="arjun@company.in" value={email} onChange={e => { setEmail(e.target.value); setEmailError(''); }} error={emailError} required />
            <Input label="Company Name" placeholder="TechCorp India" value={company} onChange={e => setCompany(e.target.value)} />
            <Input label="Phone Number" placeholder="9876543210" value={phone} onChange={e => setPhone(e.target.value)} />
            <Input label="WhatsApp Number" placeholder="9876543210" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
            <Input label="Address / Region" placeholder="Bandra West, Mumbai" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <Textarea label="Client Notes (Internal)" placeholder="Preferred payment schedules, GST registration number, brief outline..." value={notes} onChange={e => setNotes(e.target.value)} />
          <div className="flex justify-end gap-2 border-t border-border pt-4 mt-2">
            <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); setClientToEdit(null); }} type="button">Cancel</Button>
            <Button variant="primary" size="sm" type="submit" loading={submitting}>{clientToEdit ? 'Save Changes' : 'Register Client'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};

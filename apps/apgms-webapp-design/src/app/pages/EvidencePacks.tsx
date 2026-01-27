import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../store/appStore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Badge } from '../components/ui/badge';
import { StatusChip } from '../components/StatusChip';
import { EmptyState } from '../components/EmptyState';
import { Archive, Plus, Download, CheckCircle2, FileText, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { downloadJSON } from '../lib/download';
import type { EvidencePack } from '../types';

export const EvidencePacks = () => {
  const { setCurrentHelpContent } = useApp();
  const { canCreate, canVerify } = useAuth();
  const navigate = useNavigate();
  const {
    evidencePacks,
    obligations,
    createEvidencePack,
    generateEvidence,
    verifyEvidence,
    currentOrganizationId,
    currentPeriodId,
    periods,
  } = useAppStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPack, setSelectedPack] = useState<EvidencePack | null>(null);
  const [packName, setPackName] = useState('');

  useEffect(() => {
    setCurrentHelpContent({
      title: 'Evidence Packs',
      purpose: 'Immutable audit documentation packages that prove compliance. Each pack contains cryptographic hashes, obligation records, transaction manifests, and verification metadata for regulatory audits.',
      requiredInputs: ['Period selection', 'Obligations to include', 'Pack name'],
      definitions: {
        'Evidence Pack': 'Immutable collection of compliance evidence with cryptographic verification',
        'Hash': 'Cryptographic fingerprint ensuring data integrity',
        'Manifest': 'Complete list of all items in the evidence pack',
        'Verification': 'Cryptographic proof that evidence has not been tampered with',
      },
      commonMistakes: [
        'Generating packs before obligations are completed',
        'Not verifying pack integrity before audit',
        'Missing supporting documents in the pack',
      ],
      outputs: ['Evidence pack JSON/PDF', 'Cryptographic verification', 'Audit-ready documentation'],
      nextStep: 'Generate packs for completed periods, verify integrity, and export for audits.',
      atoReferences: [
        {
          title: 'Record Keeping Requirements',
          url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/records-you-need-to-keep',
          description: 'ATO requirements for keeping tax and super records'
        },
        {
          title: 'Digital Records',
          url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/records-you-need-to-keep/electronic-records',
          description: 'Requirements for electronic record keeping'
        },
      ],
    });
  }, [setCurrentHelpContent]);

  const currentPeriod = periods.find(p => p.id === currentPeriodId);
  const orgPacks = evidencePacks.filter(p => p.organizationId === currentOrganizationId);
  const orgObligations = obligations.filter(o => o.organizationId === currentOrganizationId);

  const handleCreate = () => {
    if (!packName.trim()) {
      toast.error('Please enter a pack name');
      return;
    }

    const pack = createEvidencePack({
      name: packName,
      periodId: currentPeriodId,
      organizationId: currentOrganizationId,
      obligationIds: orgObligations.map(o => o.id),
    });

    generateEvidence(pack.id);
    toast.success('Generating evidence pack...');
    setShowCreateDialog(false);
    setPackName('');
    
    // Simulate generation delay
    setTimeout(() => {
      setSelectedPack(evidencePacks.find(p => p.id === pack.id) || null);
      toast.success('Evidence pack generated');
    }, 2000);
  };

  const handleVerify = (packId: string) => {
    verifyEvidence(packId, 'Current User');
    toast.success('Evidence pack verified successfully');
    
    // Update selected pack if it's the one being verified
    if (selectedPack?.id === packId) {
      const updated = evidencePacks.find(p => p.id === packId);
      if (updated) setSelectedPack(updated);
    }
  };

  const handleDownloadJSON = (pack: EvidencePack) => {
    downloadJSON(pack, `evidence-pack-${pack.id}.json`);
    toast.success('Evidence pack downloaded as JSON');
  };

  const handleDownloadPDF = (pack: EvidencePack) => {
    // Simulate PDF generation
    const pdfContent = `
EVIDENCE PACK
=============
Name: ${pack.name}
ID: ${pack.id}
Created: ${new Date(pack.createdAt).toLocaleString()}
Status: ${pack.status}

MANIFEST:
${pack.items.map((item, i) => `${i + 1}. ${item.type}: ${item.name}`).join('\n')}

HASH: ${pack.hash}

${pack.verified ? `VERIFIED by ${pack.verifiedBy} on ${new Date(pack.verifiedAt!).toLocaleString()}` : 'NOT VERIFIED'}
    `;
    
    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evidence-pack-${pack.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Evidence pack downloaded as text (PDF simulation)');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Evidence Packs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Immutable audit documentation and compliance evidence
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4" />
            Generate Pack
          </Button>
        )}
      </div>

      {/* Packs Grid */}
      {orgPacks.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="No evidence packs"
          description="Generate your first evidence pack for audit documentation."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgPacks.map((pack) => (
            <Card key={pack.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedPack(pack)}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{pack.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(pack.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusChip status={pack.status} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Items</span>
                    <span className="font-medium">{pack.items.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Obligations</span>
                    <span className="font-medium">{pack.obligationIds.length}</span>
                  </div>
                  {pack.verified && (
                    <div className="flex items-center gap-1 text-sm text-success mt-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Verified</span>
                    </div>
                  )}
                  {!pack.verified && canVerify && pack.status === 'ready' && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVerify(pack.id);
                      }}
                    >
                      <Shield className="h-3 w-3" />
                      Verify
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Evidence Pack</DialogTitle>
            <DialogDescription>
              Create an immutable evidence pack for {currentPeriod?.label || 'current period'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="packName">Pack Name</Label>
              <Input
                id="packName"
                value={packName}
                onChange={(e) => setPackName(e.target.value)}
                placeholder={`Evidence Pack - ${currentPeriod?.label || 'Current Period'}`}
              />
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Will include:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• {orgObligations.length} obligations</li>
                <li>• All linked transactions</li>
                <li>• Ledger entries</li>
                <li>• Cryptographic hash for verification</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Generate Pack</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pack Detail Sheet */}
      <Sheet open={!!selectedPack} onOpenChange={() => setSelectedPack(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          {selectedPack && (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <SheetTitle>{selectedPack.name}</SheetTitle>
                    <SheetDescription>
                      Created {new Date(selectedPack.createdAt).toLocaleString()}
                    </SheetDescription>
                  </div>
                  <StatusChip status={selectedPack.status} />
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Status & Verification */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    {selectedPack.verified ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-success" />
                        <span className="font-semibold text-success">Verified</span>
                      </>
                    ) : (
                      <>
                        <Shield className="h-5 w-5 text-muted-foreground" />
                        <span className="font-semibold text-muted-foreground">Not Verified</span>
                      </>
                    )}
                  </div>
                  {selectedPack.verified && (
                    <p className="text-sm text-muted-foreground">
                      Verified by {selectedPack.verifiedBy} on {new Date(selectedPack.verifiedAt!).toLocaleString()}
                    </p>
                  )}
                  {!selectedPack.verified && canVerify && selectedPack.status === 'ready' && (
                    <Button size="sm" onClick={() => handleVerify(selectedPack.id)} className="mt-2">
                      <Shield className="h-4 w-4" />
                      Verify Pack
                    </Button>
                  )}
                </div>

                {/* Hash */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Cryptographic Hash</h4>
                  <div className="p-3 bg-muted rounded font-mono text-xs break-all">
                    {selectedPack.hash}
                  </div>
                </div>

                {/* Manifest */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Manifest ({selectedPack.items.length} items)</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedPack.items.map((item, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.type} • {new Date(item.generatedAt).toLocaleString()}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {item.type}
                          </Badge>
                        </div>
                        <div className="mt-2 p-2 bg-muted rounded text-xs font-mono break-all">
                          Hash: {item.hash}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Obligations */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Linked Obligations ({selectedPack.obligationIds.length})</h4>
                  <div className="space-y-2">
                    {selectedPack.obligationIds.map(oblId => {
                      const obl = obligations.find(o => o.id === oblId);
                      return obl ? (
                        <div
                          key={oblId}
                          className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            setSelectedPack(null);
                            navigate(`/obligations/${oblId}`);
                          }}
                        >
                          <p className="font-medium text-sm">{obl.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {obl.type} • ${obl.amount.toLocaleString()}
                          </p>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => handleDownloadJSON(selectedPack)} className="flex-1">
                    <Download className="h-4 w-4" />
                    Download JSON
                  </Button>
                  <Button variant="outline" onClick={() => handleDownloadPDF(selectedPack)} className="flex-1">
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
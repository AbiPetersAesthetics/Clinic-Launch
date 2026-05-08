import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProperties,
  getListPropertiesQueryKey,
  useCreateProperty,
  useUpdateProperty,
  useDeleteProperty,
} from "@workspace/api-client-react";
import type { ClinicProperty } from "@workspace/api-client-react/src/generated/api.schemas";
import { formatGBP } from "@/lib/format";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, Maximize2, PoundSterling, Clock, User, Phone, Mail, Car, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PROJECT_ID = 1;

const STATUS_COLORS: Record<string, string> = {
  viewing: "bg-muted text-muted-foreground",
  shortlisted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  offer_made: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  under_offer: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  rejected: "bg-muted text-muted-foreground line-through opacity-70",
  active: "bg-primary/20 text-primary",
};

export default function PropertiesPage() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<ClinicProperty | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: properties, isLoading } = useListProperties(PROJECT_ID, {
    query: { queryKey: getListPropertiesQueryKey(PROJECT_ID), enabled: true },
  });

  const createProperty = useCreateProperty();
  const updateProperty = useUpdateProperty();
  const deleteProperty = useDeleteProperty();

  const handleOpenCreate = () => {
    setEditingProperty(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (prop: ClinicProperty) => {
    setEditingProperty(prop);
    setIsFormOpen(true);
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteProperty.mutate(
      { id: deletingId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey(PROJECT_ID) });
          setDeletingId(null);
        },
      }
    );
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      address: formData.get("address") as string,
      postcode: formData.get("postcode") as string,
      sqFootage: Number(formData.get("sqFootage") || 0),
      annualRentGbp: Number(formData.get("annualRentGbp") || 0),
      monthlyRentGbp: Number(formData.get("monthlyRentGbp") || 0),
      vatOnRent: formData.get("vatOnRent") === "on",
      businessRatesGbp: Number(formData.get("businessRatesGbp") || 0),
      serviceChargeGbp: Number(formData.get("serviceChargeGbp") || 0),
      leaseLength: formData.get("leaseLength") as string,
      useClass: formData.get("useClass") as string,
      availabilityDate: formData.get("availabilityDate") as string || undefined,
      parkingSpaces: Number(formData.get("parkingSpaces") || 0),
      frontageMeters: Number(formData.get("frontageMeters") || 0),
      agentName: formData.get("agentName") as string,
      agentPhone: formData.get("agentPhone") as string,
      agentEmail: formData.get("agentEmail") as string,
      status: formData.get("status") as any,
      notes: formData.get("notes") as string,
    };

    if (editingProperty) {
      updateProperty.mutate(
        { id: editingProperty.id, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey(PROJECT_ID) });
            setIsFormOpen(false);
          }
        }
      );
    } else {
      createProperty.mutate(
        { projectId: PROJECT_ID, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey(PROJECT_ID) });
            setIsFormOpen(false);
          }
        }
      );
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
        <div className="h-80 bg-card rounded-lg"></div>
        <div className="h-80 bg-card rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Property Intelligence</h2>
          <p className="text-muted-foreground mt-1">Evaluate and track potential clinic locations.</p>
        </div>
        <Button onClick={handleOpenCreate}>Add Property</Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {properties?.map((prop) => (
          <Card key={prop.id} className={`shadow-sm flex flex-col ${prop.status === 'rejected' ? 'opacity-75 bg-muted/30' : ''}`}>
            <CardHeader className="pb-4 border-b">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-semibold text-lg flex items-start gap-2">
                    <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <span className={prop.status === 'rejected' ? 'line-through' : ''}>{prop.address}</span>
                  </h3>
                  <p className="text-muted-foreground text-sm ml-7">{prop.postcode}</p>
                </div>
                <Badge variant="secondary" className={STATUS_COLORS[prop.status] || ""}>
                  {prop.status.replace("_", " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 flex-1">
              <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <PoundSterling className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wider font-semibold">Monthly Rent</span>
                  </div>
                  <p className="font-medium text-lg">{formatGBP(prop.monthlyRentGbp)} {prop.vatOnRent && <span className="text-xs text-muted-foreground">+VAT</span>}</p>
                  <p className="text-xs text-muted-foreground">{formatGBP(prop.annualRentGbp)} / year</p>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Maximize2 className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wider font-semibold">Size</span>
                  </div>
                  <p className="font-medium text-lg">{prop.sqFootage?.toLocaleString()} sq ft</p>
                  <p className="text-xs text-muted-foreground">Class: {prop.useClass || 'Unknown'}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wider font-semibold">Lease Details</span>
                  </div>
                  <p className="font-medium">{prop.leaseLength || 'Negotiable'}</p>
                  <p className="text-xs text-muted-foreground">Avail: {prop.availabilityDate ? new Date(prop.availabilityDate).toLocaleDateString() : 'TBD'}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Car className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wider font-semibold">Parking</span>
                  </div>
                  <p className="font-medium">{prop.parkingSpaces ? `${prop.parkingSpaces} spaces` : 'None specified'}</p>
                </div>
              </div>

              {/* Agent Details */}
              <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">{prop.agentName || 'Agent Unknown'}</span>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground ml-6">
                  {prop.agentPhone && (
                    <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {prop.agentPhone}</div>
                  )}
                  {prop.agentEmail && (
                    <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {prop.agentEmail}</div>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/20 border-t p-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => handleOpenEdit(prop)}>
                <Pencil className="w-4 h-4 mr-2" /> Edit
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeletingId(prop.id)}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            </CardFooter>
          </Card>
        ))}

        {(!properties || properties.length === 0) && (
          <div className="col-span-full py-12 text-center border border-dashed rounded-lg">
            <h3 className="text-lg font-medium">No properties added yet</h3>
            <p className="text-muted-foreground mt-1 mb-4">Start building your property pipeline.</p>
            <Button onClick={handleOpenCreate}>Add First Property</Button>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProperty ? 'Edit Property' : 'Add Property'}</DialogTitle>
            <DialogDescription>Enter the property details and agent contact information.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-6 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" defaultValue={editingProperty?.address || ""} required className="mt-1" />
              </div>
              
              <div>
                <Label htmlFor="postcode">Postcode</Label>
                <Input id="postcode" name="postcode" defaultValue={editingProperty?.postcode || ""} required className="mt-1" />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue={editingProperty?.status || "viewing"}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewing">Viewing</SelectItem>
                    <SelectItem value="shortlisted">Shortlisted</SelectItem>
                    <SelectItem value="offer_made">Offer Made</SelectItem>
                    <SelectItem value="under_offer">Under Offer</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="active">Active (Secured)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
              <h4 className="font-semibold text-sm">Financials & Specs</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="monthlyRentGbp">Monthly Rent (£)</Label>
                  <Input id="monthlyRentGbp" name="monthlyRentGbp" type="number" defaultValue={editingProperty?.monthlyRentGbp || ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="annualRentGbp">Annual Rent (£)</Label>
                  <Input id="annualRentGbp" name="annualRentGbp" type="number" defaultValue={editingProperty?.annualRentGbp || ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="businessRatesGbp">Business Rates (£/yr)</Label>
                  <Input id="businessRatesGbp" name="businessRatesGbp" type="number" defaultValue={editingProperty?.businessRatesGbp || ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="serviceChargeGbp">Service Charge (£/yr)</Label>
                  <Input id="serviceChargeGbp" name="serviceChargeGbp" type="number" defaultValue={editingProperty?.serviceChargeGbp || ""} className="mt-1" />
                </div>
                <div className="col-span-2 flex items-center justify-between p-3 border rounded bg-card mt-2">
                  <Label htmlFor="vatOnRent" className="mb-0">VAT applicable on rent?</Label>
                  <Switch id="vatOnRent" name="vatOnRent" defaultChecked={editingProperty?.vatOnRent || false} />
                </div>
                
                <div>
                  <Label htmlFor="sqFootage">Square Footage</Label>
                  <Input id="sqFootage" name="sqFootage" type="number" defaultValue={editingProperty?.sqFootage || ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="useClass">Use Class (e.g. E)</Label>
                  <Input id="useClass" name="useClass" defaultValue={editingProperty?.useClass || ""} className="mt-1" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="leaseLength">Lease Length</Label>
                <Input id="leaseLength" name="leaseLength" defaultValue={editingProperty?.leaseLength || ""} placeholder="e.g. 5 years with 3 yr break" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="availabilityDate">Availability Date</Label>
                <Input id="availabilityDate" name="availabilityDate" type="date" defaultValue={editingProperty?.availabilityDate ? new Date(editingProperty.availabilityDate).toISOString().split('T')[0] : ""} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="parkingSpaces">Parking Spaces</Label>
                <Input id="parkingSpaces" name="parkingSpaces" type="number" defaultValue={editingProperty?.parkingSpaces || ""} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="frontageMeters">Frontage (meters)</Label>
                <Input id="frontageMeters" name="frontageMeters" type="number" step="0.1" defaultValue={editingProperty?.frontageMeters || ""} className="mt-1" />
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
              <h4 className="font-semibold text-sm">Agent Contact</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="agentName">Agent/Agency Name</Label>
                  <Input id="agentName" name="agentName" defaultValue={editingProperty?.agentName || ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="agentPhone">Phone</Label>
                  <Input id="agentPhone" name="agentPhone" defaultValue={editingProperty?.agentPhone || ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="agentEmail">Email</Label>
                  <Input id="agentEmail" name="agentEmail" type="email" defaultValue={editingProperty?.agentEmail || ""} className="mt-1" />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" defaultValue={editingProperty?.notes || ""} className="mt-1 h-24" placeholder="Condition, potential layout issues, negotiation status..." />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createProperty.isPending || updateProperty.isPending}>
                {editingProperty ? 'Save Changes' : 'Add Property'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the property record from your pipeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Property
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

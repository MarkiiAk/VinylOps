"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAD_STATUS_OPTIONS } from "@/components/lead-status-badge";
import { createLead, updateLead } from "@/lib/actions/leads";

interface LeadFormValues {
  id: string;
  name: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
}

interface LeadFormDialogProps {
  /** Si se pasa, el dialog abre en modo edición precargado con estos valores. */
  lead?: LeadFormValues;
}

/**
 * Dialog para crear o editar un lead. Mismo componente en ambos modos
 * (prioriza simplicidad sobre separar en dos archivos): si viene `lead`,
 * llama updateLead; si no, createLead. El "interés" ya no se captura aquí —
 * eso vive en cada Order (un lead puede tener 0 o varios pedidos con
 * intereses distintos), este dialog solo captura datos de contacto.
 */
export function LeadFormDialog({ lead }: LeadFormDialogProps) {
  const isEditing = Boolean(lead);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(lead?.name ?? "");
  const [phone, setPhone] = useState(lead?.phone ?? "");
  const [status, setStatus] = useState(lead?.status ?? "Contacto");
  const [notes, setNotes] = useState(lead?.notes ?? "");

  function resetForm() {
    setName(lead?.name ?? "");
    setPhone(lead?.phone ?? "");
    setStatus(lead?.status ?? "Contacto");
    setNotes(lead?.notes ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEditing && lead) {
        await updateLead(lead.id, {
          name: name || null,
          phone: phone || null,
          status,
          notes: notes || null,
        });
        toast.success("Lead actualizado");
      } else {
        await createLead({
          name: name || undefined,
          phone: phone || undefined,
          status,
          notes: notes || undefined,
        });
        toast.success("Lead registrado");
        resetForm();
      }
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(isEditing ? "No se pudo actualizar el lead" : "No se pudo registrar el lead", {
        description: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger
        render={
          isEditing ? (
            <Button size="icon-sm" variant="ghost" title="Editar lead">
              <Pencil className="size-3.5" />
            </Button>
          ) : (
            <Button size="sm" className="gap-1.5">
              <UserPlus className="size-3.5" />
              Nuevo lead
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar lead" : "Nuevo lead"}</DialogTitle>
          <DialogDescription>
            Registra el contacto de una clienta que escribió por WhatsApp — el detalle de qué quiere se captura
            al crear su primer pedido.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lead-name">Nombre</Label>
            <Input
              id="lead-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-phone">Teléfono</Label>
            <Input
              id="lead-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-status">Status</Label>
            <Select value={status} items={LEAD_STATUS_OPTIONS} onValueChange={(value) => setStatus(value ?? "Contacto")}>
              <SelectTrigger id="lead-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-notes">Notas</Label>
            <Textarea
              id="lead-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional: qué se le dijo, si falta responder, etc."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Guardando..." : isEditing ? "Guardar cambios" : "Registrar lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Source } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Pencil, Trash2, Plus, Database } from "lucide-react";

interface SourceMaintenanceProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SourceMaintenance({ isOpen, onClose }: SourceMaintenanceProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [newSourceName, setNewSourceName] = useState("");
    const [editingSource, setEditingSource] = useState<Source | null>(null);

    const { data: sources, isLoading } = useQuery<Source[]>({
        queryKey: ["/api/sources"],
    });

    const createMutation = useMutation({
        mutationFn: async (name: string) => {
            return apiRequest("POST", "/api/sources", { name });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
            setNewSourceName("");
            toast({ title: "Source added successfully" });
        },
        onError: (error) => {
            toast({ title: "Failed to add source", description: error.message, variant: "destructive" });
        }
    });

    const updateMutation = useMutation({
        mutationFn: async (source: Source) => {
            return apiRequest("PUT", `/api/sources/${source.id}`, { name: source.name });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
            setEditingSource(null);
            toast({ title: "Source updated successfully" });
        },
        onError: (error) => {
            toast({ title: "Failed to update source", description: error.message, variant: "destructive" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            await apiRequest("DELETE", `/api/sources/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
            toast({ title: "Source deleted successfully" });
        },
        onError: () => {
             toast({ title: "Failed to delete source", variant: "destructive" });
        }
    });

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Manage Question Sources
                    </DialogTitle>
                </DialogHeader>

                <div className="flex gap-2 mb-4">
                    <Input 
                        placeholder="New source name..." 
                        value={newSourceName}
                        onChange={(e) => setNewSourceName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && newSourceName.trim()) {
                                createMutation.mutate(newSourceName.trim());
                            }
                        }}
                    />
                    <Button 
                        disabled={!newSourceName.trim() || createMutation.isPending}
                        onClick={() => createMutation.mutate(newSourceName.trim())}
                    >
                        <Plus className="h-4 w-4 mr-2" /> Add
                    </Button>
                </div>

                <div className="border rounded-md overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Source Name</TableHead>
                                <TableHead className="w-[100px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center py-4 text-neutral-500">Loading sources...</TableCell>
                                </TableRow>
                            ) : sources?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center py-4 text-neutral-500">No sources found.</TableCell>
                                </TableRow>
                            ) : (
                                sources?.map((source) => (
                                    <TableRow key={source.id}>
                                        <TableCell>
                                            {editingSource?.id === source.id ? (
                                                <Input 
                                                    autoFocus
                                                    value={editingSource.name}
                                                    onChange={(e) => setEditingSource({ ...editingSource, name: e.target.value })}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && editingSource.name.trim()) {
                                                            updateMutation.mutate(editingSource);
                                                        } else if (e.key === 'Escape') {
                                                            setEditingSource(null);
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        if (editingSource.name.trim() && editingSource.name !== source.name) {
                                                            updateMutation.mutate(editingSource);
                                                        } else {
                                                            setEditingSource(null);
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                source.name
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {editingSource?.id !== source.id && (
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => setEditingSource(source)}>
                                                        <Pencil className="h-4 w-4 text-blue-500" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => {
                                                        if (confirm(`Delete source "${source.name}"? This might affect questions using it.`)) {
                                                            deleteMutation.mutate(source.id);
                                                        }
                                                    }}>
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
}

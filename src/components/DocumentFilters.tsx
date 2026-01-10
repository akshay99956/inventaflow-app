import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, User, Filter, X } from "lucide-react";

interface Client {
  id: string;
  name: string;
}

interface DocumentFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  statusOptions: { value: string; label: string }[];
  showClientFilter?: boolean;
}

export interface FilterState {
  dateFrom: string;
  dateTo: string;
  clientId: string;
  status: string;
}

export const DocumentFilters = ({ 
  onFiltersChange, 
  statusOptions,
  showClientFilter = true 
}: DocumentFiltersProps) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: "",
    dateTo: "",
    clientId: "",
    status: "",
  });

  useEffect(() => {
    if (showClientFilter) {
      fetchClients();
    }
  }, [showClientFilter]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from("clients")
      .select("id, name")
      .order("name");
    
    if (data) {
      setClients(data);
    }
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters: FilterState = {
      dateFrom: "",
      dateTo: "",
      clientId: "",
      status: "",
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const hasActiveFilters = filters.dateFrom || filters.dateTo || filters.clientId || filters.status;

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-r from-muted/30 to-muted/10">
      <CardContent className="py-2 md:py-4 px-2 md:px-6">
        <div className="flex items-center gap-2 md:gap-4">
          {/* Filter Icon - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-2 text-muted-foreground">
            <Filter className="h-4 w-4" />
          </div>

          {/* All filters in a single row */}
          <div className="grid grid-cols-4 md:flex md:flex-wrap gap-1.5 md:gap-3 flex-1 items-center">
            {/* Date From */}
            <div className="flex flex-col">
              <Label className="text-[9px] md:text-xs text-muted-foreground mb-0.5">From</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                className="h-7 md:h-8 text-[10px] md:text-sm px-1.5 md:px-3 w-full md:w-32"
              />
            </div>

            {/* Date To */}
            <div className="flex flex-col">
              <Label className="text-[9px] md:text-xs text-muted-foreground mb-0.5">To</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                className="h-7 md:h-8 text-[10px] md:text-sm px-1.5 md:px-3 w-full md:w-32"
              />
            </div>

            {/* Client Filter */}
            {showClientFilter && (
              <div className="flex flex-col">
                <Label className="text-[9px] md:text-xs text-muted-foreground mb-0.5">Client</Label>
                <Select
                  value={filters.clientId}
                  onValueChange={(value) => handleFilterChange("clientId", value === "all" ? "" : value)}
                >
                  <SelectTrigger className="h-7 md:h-8 text-[10px] md:text-sm px-1.5 md:px-3 w-full md:w-36">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Status Filter */}
            <div className="flex flex-col">
              <Label className="text-[9px] md:text-xs text-muted-foreground mb-0.5">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => handleFilterChange("status", value === "all" ? "" : value)}
              >
                <SelectTrigger className="h-7 md:h-8 text-[10px] md:text-sm px-1.5 md:px-3 w-full md:w-28">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

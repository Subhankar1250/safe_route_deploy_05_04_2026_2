
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useSupabaseDrivers } from '@/hooks/useSupabaseDrivers';
import DriverFormSupabase from './drivers/DriverFormSupabase';
import DriversTableSupabase from './drivers/DriversTableSupabase';
import SearchBar from './drivers/SearchBar';
import QrCodeDialog from './drivers/QrCodeDialog';
import EditDriverDialog from './drivers/EditDriverDialog';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Driver } from '@/services/driverService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

const AdminDrivers: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentQrCode, setCurrentQrCode] = useState<string | null>(null);
  const [selectedDriverCredentials, setSelectedDriverCredentials] = useState<{username: string, password: string} | null>(null);
  const [qrWelcomeContext, setQrWelcomeContext] = useState<{
    name: string;
    mobile: string;
    busNumber: string;
    pin?: string;
  } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{open: boolean, driver: Driver | null}>({open: false, driver: null});
  const { drivers, loading, addDriver, updateDriver, removeDriver, regenerateDriverQrToken } =
    useSupabaseDrivers();
  const [loginOrigin, setLoginOrigin] = useState("");

  useEffect(() => {
    setLoginOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  const handleAddDriver = async (driverFormData: any) => {
    try {
      const result = await addDriver(driverFormData);
      
      // Show the QR code with mobile number for login
      if (result?.newDriver) {
        const d = result.newDriver;
        setCurrentQrCode(
          JSON.stringify({
            v: 2,
            driverId: d.id,
            token: d.qr_token,
          }),
        );
        setSelectedDriverCredentials({
          username: result.mobileNumber,
          password: "QR or mobile",
        });
        const pin =
          typeof d.initial_portal_pin === "string" && /^\d{6}$/.test(d.initial_portal_pin)
            ? d.initial_portal_pin
            : undefined;
        setQrWelcomeContext({
          name: d.name,
          mobile: result.mobileNumber,
          busNumber: driverFormData.bus_number ?? d.bus_number ?? "",
          pin,
        });
      }
      
      setShowAddForm(false);
      return result;
    } catch (error) {
      console.error('Error in handleAddDriver:', error);
    }
  };

  const handleDeleteDriver = (id: string) => {
    const driver = drivers.find(d => d.id === id);
    if (driver) {
      setDeleteConfirm({open: true, driver});
    }
  };

  const confirmDeleteDriver = async () => {
    if (deleteConfirm.driver) {
      await removeDriver(deleteConfirm.driver.id);
      setDeleteConfirm({open: false, driver: null});
    }
  };

  const handleViewQrCode = (driver: Driver) => {
    if (driver.qr_token && driver.id) {
      setCurrentQrCode(
        JSON.stringify({
          v: 2,
          driverId: driver.id,
          token: driver.qr_token,
        }),
      );
      const mobile = driver.mobile_number || driver.profile?.username || "";
      setSelectedDriverCredentials({
        username: mobile || "—",
        password: "QR or mobile",
      });
      setQrWelcomeContext({
        name: driver.name,
        mobile,
        busNumber: driver.bus_number ?? "",
      });
    }
  };

  const handleRegenerateQr = async (driver: Driver) => {
    try {
      const updated = await regenerateDriverQrToken(driver.id);
      if (updated?.qr_token) {
        setCurrentQrCode(
          JSON.stringify({
            v: 2,
            driverId: driver.id,
            token: updated.qr_token,
          }),
        );
        const mobile = driver.mobile_number || driver.profile?.username || "";
        setSelectedDriverCredentials({
          username: mobile || "—",
          password: "QR or mobile",
        });
        setQrWelcomeContext({
          name: driver.name,
          mobile,
          busNumber: driver.bus_number ?? "",
        });
      }
    } catch {
      /* toast in hook */
    }
  };

  const handleEditDriver = (driver: Driver) => {
    setEditingDriver(driver);
  };

  const handleUpdateDriver = async (id: string, data: any) => {
    try {
      await updateDriver(id, data);
      setEditingDriver(null);
    } catch (error) {
      console.error('Error updating driver:', error);
    }
  };

  const handleCloseEditDialog = () => {
    setEditingDriver(null);
  };

  const handleCloseQrDialog = () => {
    setCurrentQrCode(null);
    setSelectedDriverCredentials(null);
    setQrWelcomeContext(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Drivers</h2>
          <p className="text-sm text-muted-foreground">
            Each driver gets a dynamic QR at creation. Renew QR if a code is leaked.
          </p>
        </div>
        <div className="flex space-x-2">
          <SearchBar 
            searchTerm={searchTerm} 
            onSearchChange={setSearchTerm} 
          />
          <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Driver
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Driver</DialogTitle>
              </DialogHeader>
              <DriverFormSupabase 
                onSubmit={handleAddDriver}
                onCancel={() => setShowAddForm(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <DriversTableSupabase 
        drivers={drivers}
        loading={loading}
        searchTerm={searchTerm}
        loginOrigin={loginOrigin}
        onViewQrCode={handleViewQrCode}
        onRegenerateQr={handleRegenerateQr}
        onEditDriver={handleEditDriver}
        onDeleteDriver={handleDeleteDriver}
      />
      
      <QrCodeDialog
        isOpen={!!currentQrCode}
        onClose={handleCloseQrDialog}
        qrCodeData={currentQrCode}
        credentials={selectedDriverCredentials}
        loginPageUrl={loginOrigin}
        welcomeContext={qrWelcomeContext?.mobile ? qrWelcomeContext : null}
      />

      {editingDriver && (
        <EditDriverDialog
          driver={editingDriver}
          onUpdate={handleUpdateDriver}
          onClose={handleCloseEditDialog}
          open={!!editingDriver}
        />
      )}

      <ConfirmationDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({open, driver: null})}
        title="Delete Driver"
        description={`Are you sure you want to delete ${deleteConfirm.driver?.name}? This will permanently remove the driver, their profile, and all associated data including location history, trip sessions, and other records. This action cannot be undone.`}
        onConfirm={confirmDeleteDriver}
      />
    </div>
  );
};

export default AdminDrivers;

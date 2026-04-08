import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Grid3X3, 
  Zap, 
  FlaskConical, 
  Users, 
  Plus, 
  Settings,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Map as MapIcon,
  Search,
  Filter,
  MoreVertical,
  ArrowLeft,
  Download,
  Upload,
  HardHat,
  Wrench,
  FileText,
  X,
  Image as ImageIcon,
  Trash2,
  Camera,
  Radio,
  Plane,
  Signal,
  Cpu,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import EXIF from 'exif-js';
import { MapContainer, TileLayer, ImageOverlay, Polygon, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Project, Roll, Panel, Seam, DestructiveTest, Welder, Repair, Status, MediaRecord, GPSSource, Drone } from './types';
import { ProjectForm, RollForm, PanelForm, SeamForm, WelderForm, DestructiveTestForm, RepairForm } from './components/Forms';
import { cn } from './lib/utils';
import { mediaDB } from './services/dbService';

// --- MODAL COMPONENT ---
function Modal({ title, isOpen, onClose, children }: { title: string, isOpen: boolean, onClose: () => void, children: React.ReactNode }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-industrial-gray border border-industrial-border w-full max-w-xl overflow-hidden"
      >
        <div className="p-6 border-b border-industrial-border flex justify-between items-center bg-white/5">
          <h3 className="text-sm font-bold uppercase tracking-widest text-construction-orange">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-8 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

// --- MAIN APP ---
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mapMode, setMapMode] = useState<'Drone' | 'Satellite' | 'Schematic'>('Schematic');
  const [modalType, setModalType] = useState<string | null>(null);
  
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('ls_projects');
    return saved ? JSON.parse(saved) : [
      {
        id: 'p1',
        name: 'Clayton WWTP Phase 2',
        client: 'City of Clayton',
        site: 'Clayton, NC',
        materialSpec: { type: 'HDPE', thickness: 60, surface: 'Textured-2', peelThreshold: 60, shearThreshold: 90 },
        createdAt: new Date().toISOString()
      }
    ];
  });
  
  const [activeProjectId, setActiveProjectId] = useState<string>(projects[0]?.id || '');
  const [orientation, setOrientation] = useState({ alpha: 0, beta: 0, gamma: 0 });

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      setOrientation({
        alpha: (e as any).webkitCompassHeading || e.alpha || 0,
        beta: e.beta || 0,
        gamma: e.gamma || 0
      });
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);
  
  const [rolls, setRolls] = useState<Roll[]>(() => {
    const saved = localStorage.getItem('ls_rolls');
    return saved ? JSON.parse(saved) : [
      {
        id: 'r1',
        projectId: 'p1',
        rollNumber: 'R-10293',
        lotNumber: 'L-9928',
        manufacturer: 'Solmax',
        width: 23,
        length: 500,
        mfrCert: true,
        conformanceCert: true,
        status: 'Approved',
        receivedAt: new Date().toISOString()
      }
    ];
  });
  
  const [panels, setPanels] = useState<Panel[]>(() => {
    const saved = localStorage.getItem('ls_panels');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [seams, setSeams] = useState<Seam[]>(() => {
    const saved = localStorage.getItem('ls_seams');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [tests, setTests] = useState<DestructiveTest[]>(() => {
    const saved = localStorage.getItem('ls_tests');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [welders, setWelders] = useState<Welder[]>(() => {
    const saved = localStorage.getItem('ls_welders');
    return saved ? JSON.parse(saved) : [
      { id: 'w1', name: 'John Doe', idNumber: 'WD-001', certifications: ['Fusion', 'Extrusion'], status: 'Active' },
      { id: 'w2', name: 'Jane Smith', idNumber: 'WD-002', certifications: ['Fusion'], status: 'Active' }
    ];
  });

  const [repairs, setRepairs] = useState<Repair[]>(() => {
    const saved = localStorage.getItem('ls_repairs');
    return saved ? JSON.parse(saved) : [];
  });

  const [media, setMedia] = useState<MediaRecord[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number, altitude?: number} | null>(null);
  const [gpsSource, setGpsSource] = useState<GPSSource>('Internal');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [lastGpsUpdate, setLastGpsUpdate] = useState<number>(Date.now());
  const [gpsNotification, setGpsNotification] = useState<string | null>(null);
  const [drones, setDrones] = useState<Drone[]>(() => {
    const saved = localStorage.getItem('ls_drones');
    return saved ? JSON.parse(saved) : [
      { id: 'd1', model: 'Mini 5 Pro', serialNumber: 'DJI-M5-001', status: 'Active' },
      { id: 'd2', model: 'Air 2S', serialNumber: 'DJI-A2-002', status: 'Active' },
      { id: 'd3', model: 'Neo 1', serialNumber: 'DJI-N1-003', status: 'Active' }
    ];
  });

  useEffect(() => {
    // Hot-Swap Listener: Notify user when source changes
    if (currentLocation) {
      setGpsNotification(`GPS SOURCE CHANGED: NOW USING ${gpsSource === 'Internal' ? 'S25 INTERNAL' : 'BN-880 EXTERNAL'}`);
      setTimeout(() => setGpsNotification(null), 4000);
    }

    // Clear location when source changes to prevent stale data inheritance
    setCurrentLocation(null);
    setGpsAccuracy(null);

    if (gpsSource === 'Internal') {
      if ("geolocation" in navigator) {
        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            setCurrentLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              altitude: position.coords.altitude || undefined
            });
            setGpsAccuracy(position.coords.accuracy);
            setLastGpsUpdate(Date.now());
          },
          (error) => {
            console.error("Geolocation error:", error);
            setCurrentLocation(null);
            setGpsAccuracy(null);
          },
          { 
            enableHighAccuracy: true, 
            maximumAge: 0, 
            timeout: 5000 
          }
        );
        return () => navigator.geolocation.clearWatch(watchId);
      }
    } else {
      // Mock BN-880 NMEA data bridge (Secondary Source)
      const interval = setInterval(() => {
        setCurrentLocation(prev => ({
          latitude: (prev?.latitude || 36.4515) + (Math.random() - 0.5) * 0.00001,
          longitude: (prev?.longitude || -103.1841) + (Math.random() - 0.5) * 0.00001,
          altitude: 1250.5 + Math.random()
        }));
        setGpsAccuracy(0.4 + Math.random() * 0.2); // High precision sub-meter
        setLastGpsUpdate(Date.now());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gpsSource]);

  // Stale Data Guard: Monitor signal integrity
  useEffect(() => {
    const interval = setInterval(() => {
      const isStale = Date.now() - lastGpsUpdate > 3000;
      if (isStale && currentLocation) {
        // Signal icon will reflect this via the accuracy/update logic
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lastGpsUpdate, currentLocation]);

  useEffect(() => {
    const loadMedia = async () => {
      const allMedia = await mediaDB.getAll();
      setMedia(allMedia);
    };
    loadMedia();
  }, [modalType]); // Reload when modals close (likely after save)

  const activeProject = projects.find(p => p.id === activeProjectId);

  useEffect(() => {
    localStorage.setItem('ls_projects', JSON.stringify(projects));
    localStorage.setItem('ls_rolls', JSON.stringify(rolls));
    localStorage.setItem('ls_panels', JSON.stringify(panels));
    localStorage.setItem('ls_seams', JSON.stringify(seams));
    localStorage.setItem('ls_tests', JSON.stringify(tests));
    localStorage.setItem('ls_welders', JSON.stringify(welders));
    localStorage.setItem('ls_repairs', JSON.stringify(repairs));
    localStorage.setItem('ls_drones', JSON.stringify(drones));
  }, [projects, rolls, panels, seams, tests, welders, repairs, drones]);

  const handleAddProject = (project: Project) => {
    setProjects([...projects, project]);
    setActiveProjectId(project.id);
    setModalType(null);
  };

  const handleAddRoll = (roll: Roll) => {
    setRolls([...rolls, roll]);
    setModalType(null);
  };

  const handleAddPanel = (panel: Panel) => {
    setPanels([...panels, panel]);
    setModalType(null);
  };

  const handleAddSeam = (seam: Seam) => {
    setSeams([...seams, seam]);
    setModalType(null);
  };

  const handleAddWelder = (welder: Welder) => {
    setWelders([...welders, welder]);
    setModalType(null);
  };

  const handleAddTest = (test: DestructiveTest) => {
    setTests([...tests, test]);
    setModalType(null);
  };

  const handleAddRepair = (repair: Repair) => {
    setRepairs([...repairs, repair]);
    setModalType(null);
  };

  const generateDailyReport = async () => {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();
    let currentY = 15;
    
    // Header
    doc.setFontSize(20);
    doc.text('LINERSYNC DAILY QC REPORT', 105, currentY, { align: 'center' });
    currentY += 10;
    doc.setFontSize(10);
    doc.text(`Project: ${activeProject?.name || 'N/A'}`, 14, currentY);
    currentY += 5;
    doc.text(`Date: ${date}`, 14, currentY);
    currentY += 5;
    doc.text(`Client: ${activeProject?.client || 'N/A'}`, 14, currentY);
    currentY += 10;

    const addTable = (title: string, head: string[][], body: any[][]) => {
      doc.setFontSize(14);
      doc.text(title, 14, currentY);
      (doc as any).autoTable({
        startY: currentY + 5,
        head,
        body,
        theme: 'striped',
        headStyles: { fillColor: [255, 102, 0] }, // Industrial Orange
        margin: { top: 10 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    };

    // Rolls Table
    addTable('1. Material Inventory (Rolls)', 
      [['Roll #', 'Lot #', 'Mfr', 'Dimensions', 'Status']], 
      rolls.filter(r => r.projectId === activeProjectId).map(r => [r.rollNumber, r.lotNumber, r.manufacturer, `${r.width}'x${r.length}'`, r.status])
    );

    // Panels Table
    addTable('2. Panel Deployment', 
      [['Panel #', 'Roll #', 'Area (SF)', 'Deployed At']], 
      panels.filter(p => p.projectId === activeProjectId).map(p => [
        `P-${p.panelNumber}`, 
        rolls.find(r => r.id === p.rollId)?.rollNumber || 'N/A', 
        p.area, 
        new Date(p.deployedAt).toLocaleDateString()
      ])
    );

    // Seams Table
    addTable('3. Seaming Log', 
      [['Seam #', 'Panels', 'Welder', 'Type', 'Length', 'Status']], 
      seams.filter(s => s.projectId === activeProjectId).map(s => [
        s.seamNumber, 
        'P-01 | P-02', 
        welders.find(w => w.id === s.welderId)?.name || 'N/A', 
        s.type, 
        `${s.length}'`, 
        s.status
      ])
    );

    // Repairs Table
    addTable('4. Repair/Patch Log', 
      [['Repair #', 'Panel', 'Type', 'Welder', 'Status']], 
      repairs.filter(r => r.projectId === activeProjectId).map(r => [
        r.repairNumber, 
        `P-${panels.find(p => p.id === r.panelId)?.panelNumber || 'N/A'}`, 
        r.type, 
        welders.find(w => w.id === r.welderId)?.name || 'N/A', 
        r.status
      ])
    );

    // Map Overview Section
    doc.addPage();
    doc.setFontSize(18);
    doc.text('MAP OVERVIEW', 105, 20, { align: 'center' });
    currentY = 30;

    if (mapMode === 'Schematic') {
      doc.setFontSize(12);
      doc.text('TECHNICAL SCHEMATIC (AS-BUILT)', 14, currentY);
      currentY += 10;
      
      // Draw a simplified schematic using jsPDF primitives
      doc.setDrawColor(255, 102, 0); // Orange
      doc.setLineWidth(0.5);
      
      panels.filter(p => p.projectId === activeProjectId).forEach((p, i) => {
        const x = 20 + (i * 10);
        const y = currentY + (i * 5);
        doc.rect(x, y, 20, 30);
        doc.setFontSize(6);
        doc.text(`P-${p.panelNumber}`, x + 10, y + 15, { align: 'center' });
      });
      
      currentY += 60;
      doc.setFontSize(10);
      doc.text('Note: This is a clean vector schematic generated in emergency mode.', 14, currentY);
    } else {
      doc.setFontSize(12);
      doc.text(`VIEWPORT MODE: ${mapMode.toUpperCase()}`, 14, currentY);
      currentY += 10;
      doc.setFontSize(10);
      doc.text('Satellite/Drone imagery is available in the digital dashboard.', 14, currentY);
      doc.text('Refer to the Photo Appendix for high-resolution site captures.', 14, currentY + 5);
      currentY += 20;
    }

    // Photo Appendix
    const projectMedia = media.filter(m => {
      // This is a bit complex since we need to match parentId with actual records
      // For simplicity, we'll just show all media for now or filter by date
      return true; 
    });

    if (projectMedia.length > 0) {
      doc.addPage();
      doc.setFontSize(18);
      doc.text('PHOTO APPENDIX', 105, 20, { align: 'center' });
      
      let photoX = 14;
      let photoY = 30;
      const photoSize = 60;
      const padding = 10;

      for (const m of projectMedia) {
        if (photoY + photoSize > 280) {
          doc.addPage();
          photoY = 20;
        }

        try {
          const imgData = await blobToBase64(m.data);
          doc.addImage(imgData, 'JPEG', photoX, photoY, photoSize, photoSize);
          doc.setFontSize(8);
          doc.text(`${m.parentType}: ${m.parentId}`, photoX, photoY + photoSize + 5);
          
          let metaText = new Date(m.timestamp).toLocaleString();
          if (m.droneId) {
            const drone = drones.find(d => d.id === m.droneId);
            metaText += ` | Drone: ${drone?.model || 'Unknown'}`;
            if (m.location?.altitude) metaText += ` | Alt: ${m.location.altitude.toFixed(1)}m`;
          }
          doc.text(metaText, photoX, photoY + photoSize + 10);
        } catch (e) {
          console.error('Error adding image to PDF', e);
        }

        photoX += photoSize + padding;
        if (photoX + photoSize > 200) {
          photoX = 14;
          photoY += photoSize + 25;
        }
      }
    }

    doc.save(`LINERSYNC_Report_${activeProject?.name}_${date.replace(/\//g, '-')}.pdf`);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard project={activeProject} rolls={rolls} panels={panels} seams={seams} tests={tests} projects={projects} onSwitchProject={setActiveProjectId} />;
      case 'rolls': return <RollsList rolls={rolls.filter(r => r.projectId === activeProjectId)} onAdd={() => setModalType('newRoll')} />;
      case 'panels': return <PanelsList panels={panels.filter(p => p.projectId === activeProjectId)} rolls={rolls} onAdd={() => setModalType('newPanel')} />;
      case 'seams': return <SeamsList seams={seams.filter(s => s.projectId === activeProjectId)} welders={welders} onAdd={() => setModalType('newSeam')} />;
      case 'tests': return <TestsList tests={tests} seams={seams} onAdd={() => setModalType('newTest')} />;
      case 'repairs': return <RepairsList repairs={repairs.filter(r => r.projectId === activeProjectId)} panels={panels} welders={welders} onAdd={() => setModalType('newRepair')} />;
      case 'vision': return <VisionHUD currentLocation={currentLocation} seams={seams} repairs={repairs} tests={tests} media={media} orientation={orientation} />;
      case 'welders': return <WeldersList welders={welders} onAdd={() => setModalType('newWelder')} />;
      case 'media': return <MediaLog media={media} onDelete={async (id) => { await mediaDB.delete(id); setMedia(media.filter(m => m.id !== id)); }} />;
      case 'drones': return <DroneFleet drones={drones} media={media} panels={panels} seams={seams} onAddMedia={async (record) => { await mediaDB.add(record); setMedia([...media, record]); }} />;
      case 'map': return (
        <AsBuiltMap 
          panels={panels.filter(p => p.projectId === activeProjectId)} 
          seams={seams.filter(s => s.projectId === activeProjectId)} 
          repairs={repairs.filter(r => r.projectId === activeProjectId)}
          tests={tests.filter(t => seams.find(s => s.id === t.seamId)?.projectId === activeProjectId)}
          media={media}
          mapMode={mapMode}
          setMapMode={setMapMode}
          currentLocation={currentLocation}
          activeProjectId={activeProjectId}
        />
      );
      default: return <Dashboard project={activeProject} rolls={rolls} panels={panels} seams={seams} tests={tests} projects={projects} onSwitchProject={setActiveProjectId} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans bg-[#0A0A0A]">
      {/* Sidebar */}
      <aside className="w-64 bg-industrial-gray border-r border-industrial-border flex flex-col z-20">
        <div className="p-6 border-b border-industrial-border">
          <h1 className="text-2xl font-black tracking-tighter text-construction-orange">LINERSYNC</h1>
          <p className="text-[10px] uppercase tracking-widest opacity-50 font-mono">QC Field Platform v1.0</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Package size={18} />} label="Material Inventory" active={activeTab === 'rolls'} onClick={() => setActiveTab('rolls')} />
          <NavItem icon={<Grid3X3 size={18} />} label="Panel Deployment" active={activeTab === 'panels'} onClick={() => setActiveTab('panels')} />
          <NavItem icon={<Zap size={18} />} label="Seaming Log" active={activeTab === 'seams'} onClick={() => setActiveTab('seams')} />
          <NavItem icon={<FlaskConical size={18} />} label="Destructive Tests" active={activeTab === 'tests'} onClick={() => setActiveTab('tests')} />
          <NavItem icon={<Wrench size={18} />} label="Repair Log" active={activeTab === 'repairs'} onClick={() => setActiveTab('repairs')} />
          <NavItem icon={<Eye size={18} />} label="Vision HUD (AR)" active={activeTab === 'vision'} onClick={() => setActiveTab('vision')} />
          <NavItem icon={<ImageIcon size={18} />} label="Media Log" active={activeTab === 'media'} onClick={() => setActiveTab('media')} />
          <NavItem icon={<Plane size={18} />} label="Drone Fleet" active={activeTab === 'drones'} onClick={() => setActiveTab('drones')} />
          <NavItem icon={<HardHat size={18} />} label="Welders & Personnel" active={activeTab === 'welders'} onClick={() => setActiveTab('welders')} />
          <NavItem icon={<MapIcon size={18} />} label="As-Built Map" active={activeTab === 'map'} onClick={() => setActiveTab('map')} />
        </nav>

        <div className="p-4 border-t border-industrial-border space-y-2">
          <NavItem icon={<Settings size={18} />} label="Project Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          <div className="flex items-center gap-2 p-2 text-xs opacity-50">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>System Online</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-[#0A0A0A] technical-grid relative">
        {/* Telemetry Bar */}
        <div className="h-10 bg-black border-b border-industrial-border flex items-center px-8 justify-between z-30">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Radio 
                size={14} 
                className={cn(
                  "animate-pulse",
                  (Date.now() - lastGpsUpdate > 3000) ? "text-orange-500" :
                  !gpsAccuracy || gpsAccuracy > 10 ? "text-red-500" : 
                  gpsAccuracy > 3 ? "text-safety-yellow" : "text-green-500"
                )} 
              />
              <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
                {Date.now() - lastGpsUpdate > 3000 ? 'SIGNAL STALE' : gpsAccuracy ? `Fix: ${gpsAccuracy.toFixed(1)}m` : 'No Fix'}
              </span>
            </div>
            
            <div className="h-4 w-px bg-white/10"></div>
            
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-mono text-white/30 uppercase">Driver:</span>
              <select 
                className="bg-transparent border-none text-[10px] font-mono font-bold text-construction-orange focus:ring-0 cursor-pointer p-0"
                value={gpsSource}
                onChange={(e) => setGpsSource(e.target.value as GPSSource)}
              >
                <option value="Internal" className="bg-industrial-gray">S25 INTERNAL</option>
                <option value="External (BN-880)" className="bg-industrial-gray">BN-880 EXTERNAL</option>
              </select>
            </div>

            <div className="h-4 w-px bg-white/10"></div>

            <div className="text-[10px] font-mono text-white font-bold tracking-wider">
              {currentLocation 
                ? `${Math.abs(currentLocation.latitude).toFixed(6)}° ${currentLocation.latitude >= 0 ? 'N' : 'S'}, ${Math.abs(currentLocation.longitude).toFixed(6)}° ${currentLocation.longitude >= 0 ? 'E' : 'W'}`
                : 'WAITING FOR HARDWARE LOCK...'}
            </div>

            {gpsNotification && (
              <>
                <div className="h-4 w-px bg-white/10"></div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-construction-orange animate-bounce">
                  <AlertCircle size={12} />
                  {gpsNotification}
                </div>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
              {new Date().toISOString().split('T')[1].split('.')[0]} UTC
            </div>
          </div>
        </div>

        {/* Top Bar */}
        <header className="h-16 border-b border-industrial-border bg-industrial-gray/80 backdrop-blur-md flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-4">
            <div className="industrial-header">Active Project</div>
            <select 
              className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer text-white"
              value={activeProjectId}
              onChange={(e) => setActiveProjectId(e.target.value)}
            >
              {projects.map(p => <option key={p.id} value={p.id} className="bg-industrial-gray">{p.name}</option>)}
            </select>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={generateDailyReport}
              className="flex items-center gap-2 bg-white/5 border border-industrial-border px-4 py-2 text-sm font-bold text-white hover:bg-white/10 transition-all"
            >
              <FileText size={18} className="text-construction-orange" />
              <span>DAILY REPORT</span>
            </button>
            <button className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/50 hover:text-white">
              <Search size={20} />
            </button>
            <button 
              onClick={() => setModalType('newProject')}
              className="flex items-center gap-2 bg-construction-orange px-4 py-2 text-sm font-bold text-black hover:bg-construction-orange/90 transition-all"
            >
              <Plus size={18} />
              <span>NEW PROJECT</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Modals */}
        <Modal title="New Project" isOpen={modalType === 'newProject'} onClose={() => setModalType(null)}>
          <ProjectForm onSave={handleAddProject} onCancel={() => setModalType(null)} />
        </Modal>
        <Modal title="Log New Roll" isOpen={modalType === 'newRoll'} onClose={() => setModalType(null)}>
          <RollForm projectId={activeProjectId} existingRolls={rolls} onSave={handleAddRoll} onCancel={() => setModalType(null)} />
        </Modal>
        <Modal title="Deploy New Panel" isOpen={modalType === 'newPanel'} onClose={() => setModalType(null)}>
          <PanelForm 
            projectId={activeProjectId} 
            rolls={rolls} 
            projectName={activeProject?.name || 'Unknown'}
            currentLocation={currentLocation}
            gpsSource={gpsSource}
            onSave={handleAddPanel} 
            onCancel={() => setModalType(null)} 
          />
        </Modal>
        <Modal title="Log New Seam" isOpen={modalType === 'newSeam'} onClose={() => setModalType(null)}>
          <SeamForm 
            projectId={activeProjectId} 
            panels={panels.filter(p => p.projectId === activeProjectId)} 
            welders={welders} 
            currentLocation={currentLocation}
            gpsSource={gpsSource}
            projectName={activeProject?.name || 'Unknown'}
            onSave={data => { setSeams([...seams, data]); setModalType(null); }} 
            onCancel={() => setModalType(null)} 
          />
        </Modal>
        <Modal title="Add Welder" isOpen={modalType === 'newWelder'} onClose={() => setModalType(null)}>
          <WelderForm onSave={handleAddWelder} onCancel={() => setModalType(null)} />
        </Modal>
        <Modal title="New Destructive Test" isOpen={modalType === 'newTest'} onClose={() => setModalType(null)}>
          <DestructiveTestForm 
            seams={seams} 
            project={activeProject!} 
            currentLocation={currentLocation}
            gpsSource={gpsSource}
            projectName={activeProject?.name || 'Unknown'}
            onSave={handleAddTest} 
            onCancel={() => setModalType(null)} 
          />
        </Modal>
        <Modal title="Log New Repair" isOpen={modalType === 'newRepair'} onClose={() => setModalType(null)}>
          <RepairForm 
            projectId={activeProjectId} 
            panels={panels} 
            welders={welders} 
            seams={seams} 
            currentLocation={currentLocation}
            gpsSource={gpsSource}
            projectName={activeProject?.name || 'Unknown'}
            onSave={handleAddRepair} 
            onCancel={() => setModalType(null)} 
          />
        </Modal>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all group ${
        active 
          ? 'bg-construction-orange text-black' 
          : 'text-gray-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      <span className={active ? 'text-black' : 'text-construction-orange'}>{icon}</span>
      <span>{label}</span>
      {active && <ChevronRight size={14} className="ml-auto" />}
    </button>
  );
}

// --- VIEW COMPONENTS ---

function Dashboard({ project, rolls, panels, seams, tests, projects, onSwitchProject }: { project?: Project, rolls: Roll[], panels: Panel[], seams: Seam[], tests: DestructiveTest[], projects: Project[], onSwitchProject: (id: string) => void }) {
  if (!project) return <div className="p-12 text-center opacity-50">No active project.</div>;

  const projectRolls = rolls.filter(r => r.projectId === project.id);
  const projectPanels = panels.filter(p => p.projectId === project.id);
  const projectSeams = seams.filter(s => s.projectId === project.id);
  
  const totalArea = projectPanels.reduce((acc, p) => acc + p.area, 0);
  const totalSeamLength = projectSeams.reduce((acc, s) => acc + s.length, 0);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">{project.name.toUpperCase()}</h2>
          <p className="text-construction-orange font-mono text-sm flex items-center gap-2">
            <MapIcon size={14} /> {project.site} | {project.client}
          </p>
        </div>
        <div className="flex flex-col items-end gap-4">
          <select 
            className="bg-industrial-gray border border-industrial-border p-2 text-xs font-mono outline-none text-white"
            value={project.id}
            onChange={(e) => onSwitchProject(e.target.value)}
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="flex gap-6">
            <StatCard label="Total Area" value={totalArea.toLocaleString()} unit="SF" />
            <StatCard label="Seaming" value={totalSeamLength.toLocaleString()} unit="LF" />
            <StatCard label="Rolls Logged" value={projectRolls.length} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="industrial-card p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="industrial-header">Recent Activity</h3>
              <button className="text-xs text-construction-orange hover:underline">View All</button>
            </div>
            <div className="space-y-4">
              <ActivityItem icon={<Package size={16} />} title="New Roll Received" detail="R-10294 (Solmax 60mil)" time="2h ago" />
              <ActivityItem icon={<Zap size={16} />} title="Seam Completed" detail="S-042 (Panel 12-13)" time="4h ago" />
              <ActivityItem icon={<FlaskConical size={16} />} title="Destructive Test Passed" detail="DT-008 (Seam S-038)" time="Yesterday" />
            </div>
          </div>

          <div className="industrial-card p-6">
            <h3 className="industrial-header mb-6">Material Utilization</h3>
            <div className="h-4 bg-white/5 rounded-full overflow-hidden flex">
              <div className="h-full bg-construction-orange" style={{ width: '65%' }}></div>
              <div className="h-full bg-safety-yellow" style={{ width: '15%' }}></div>
            </div>
            <div className="flex gap-6 mt-4 text-xs">
              <div className="flex items-center gap-2"><div className="w-2 h-2 bg-construction-orange"></div><span>Deployed (65%)</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 bg-safety-yellow"></div><span>In Inventory (15%)</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 bg-white/10"></div><span>Remaining (20%)</span></div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="industrial-card p-6 border-l-4 border-l-safety-yellow">
            <h3 className="industrial-header mb-4">Quality Alerts</h3>
            <div className="space-y-4">
              <AlertItem type="warning" text="3 Rolls pending conformance certs" />
              <AlertItem type="info" text="Trial weld required for Machine #4" />
            </div>
          </div>

          <div className="industrial-card p-6">
            <h3 className="industrial-header mb-4">Project Progress</h3>
            <div className="flex items-center justify-center p-8">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full" viewBox="0 0 36 36">
                  <path className="stroke-white/5" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="stroke-construction-orange" strokeWidth="3" strokeDasharray="75, 100" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">75%</span>
                  <span className="text-[8px] uppercase opacity-50">Complete</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RollsList({ rolls, onAdd }: { rolls: Roll[], onAdd: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Material Inventory</h2>
        <div className="flex gap-2">
          <button className="industrial-card px-4 py-2 text-sm flex items-center gap-2 hover:bg-white/5"><Download size={16} /> Export</button>
          <button className="industrial-card px-4 py-2 text-sm flex items-center gap-2 hover:bg-white/5"><Upload size={16} /> Import</button>
        </div>
      </div>

      <div className="industrial-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-industrial-border bg-white/5">
              <th className="p-4 industrial-header">Roll Number</th>
              <th className="p-4 industrial-header">Lot Number</th>
              <th className="p-4 industrial-header">Manufacturer</th>
              <th className="p-4 industrial-header">Dimensions</th>
              <th className="p-4 industrial-header">Certs</th>
              <th className="p-4 industrial-header">Status</th>
              <th className="p-4 industrial-header">Received</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {rolls.map(roll => (
              <tr key={roll.id} className="border-b border-industrial-border hover:bg-white/5 transition-colors group">
                <td className="p-4 font-mono text-sm font-bold text-construction-orange">{roll.rollNumber}</td>
                <td className="p-4 font-mono text-xs opacity-70">{roll.lotNumber}</td>
                <td className="p-4 text-sm">{roll.manufacturer}</td>
                <td className="p-4 text-xs font-mono">{roll.width}' x {roll.length}'</td>
                <td className="p-4">
                  <div className="flex gap-1">
                    <div className={`w-2 h-2 rounded-full ${roll.mfrCert ? 'bg-green-500' : 'bg-red-500'}`} title="Mfr Cert"></div>
                    <div className={`w-2 h-2 rounded-full ${roll.conformanceCert ? 'bg-green-500' : 'bg-red-500'}`} title="Conf Cert"></div>
                  </div>
                </td>
                <td className="p-4">
                  <StatusBadge status={roll.status} />
                </td>
                <td className="p-4 text-xs opacity-50">{new Date(roll.receivedAt).toLocaleDateString()}</td>
                <td className="p-4 text-right">
                  <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all">
                    <MoreVertical size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PanelsList({ panels, rolls, onAdd }: { panels: Panel[], rolls: Roll[], onAdd: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Panel Deployment</h2>
        <button 
          onClick={onAdd}
          className="bg-construction-orange text-black px-4 py-2 text-sm font-bold flex items-center gap-2"
        >
          <Plus size={18} /> DEPLOY PANEL
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {panels.length === 0 ? (
          <div className="col-span-4 py-20 text-center industrial-card border-dashed">
            <Grid3X3 size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-gray-500">No panels deployed yet.</p>
            <button className="mt-4 text-construction-orange font-bold hover:underline">Start Deployment</button>
          </div>
        ) : (
          panels.map(panel => (
            <div key={panel.id} className="industrial-card p-4 space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-xl font-black">P-{panel.panelNumber}</span>
                <span className="text-[10px] font-mono opacity-50">{new Date(panel.deployedAt).toLocaleDateString()}</span>
              </div>
              <div className="text-xs space-y-1">
                <div className="flex justify-between"><span className="opacity-50">Roll:</span> <span className="font-mono text-construction-orange">R-10293</span></div>
                <div className="flex justify-between"><span className="opacity-50">Area:</span> <span className="font-mono">{panel.area} SF</span></div>
              </div>
              <div className="pt-2 flex gap-2">
                <button className="flex-1 text-[10px] font-bold border border-industrial-border py-1 hover:bg-white/5">DETAILS</button>
                <button className="flex-1 text-[10px] font-bold border border-industrial-border py-1 hover:bg-white/5">SEAMS</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SeamsList({ seams, welders, onAdd }: { seams: Seam[], welders: Welder[], onAdd: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Seaming Log</h2>
        <button 
          onClick={onAdd}
          className="bg-construction-orange text-black px-4 py-2 text-sm font-bold flex items-center gap-2"
        >
          <Plus size={18} /> LOG SEAM
        </button>
      </div>

      <div className="industrial-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-industrial-border bg-white/5">
              <th className="p-4 industrial-header">Seam ID</th>
              <th className="p-4 industrial-header">Panels</th>
              <th className="p-4 industrial-header">Welder</th>
              <th className="p-4 industrial-header">Type</th>
              <th className="p-4 industrial-header">Length</th>
              <th className="p-4 industrial-header">Status</th>
              <th className="p-4 industrial-header">Date</th>
            </tr>
          </thead>
          <tbody>
            {seams.length === 0 ? (
              <tr><td colSpan={7} className="p-12 text-center text-gray-500 italic">No seams recorded.</td></tr>
            ) : (
              seams.map(seam => (
                <tr key={seam.id} className="border-b border-industrial-border hover:bg-white/5 transition-colors">
                  <td className="p-4 font-mono text-sm font-bold text-construction-orange">{seam.seamNumber}</td>
                  <td className="p-4 text-xs font-mono">P-01 | P-02</td>
                  <td className="p-4 text-sm">{welders.find(w => w.id === seam.welderId)?.name}</td>
                  <td className="p-4 text-xs">{seam.type}</td>
                  <td className="p-4 text-xs font-mono">{seam.length}'</td>
                  <td className="p-4"><StatusBadge status={seam.status} /></td>
                  <td className="p-4 text-xs opacity-50">{new Date(seam.weldedAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TestsList({ tests, seams, onAdd }: { tests: DestructiveTest[], seams: Seam[], onAdd: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Destructive Testing</h2>
        <button 
          onClick={onAdd}
          className="bg-construction-orange text-black px-4 py-2 text-sm font-bold flex items-center gap-2"
        >
          <Plus size={18} /> NEW SAMPLE
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {tests.length === 0 ? (
          <div className="col-span-3 py-20 text-center industrial-card border-dashed">
            <FlaskConical size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-gray-500">No destructive tests recorded.</p>
          </div>
        ) : (
          tests.map(test => (
            <div key={test.id} className={`industrial-card p-6 border-t-4 ${test.overallPass ? 'border-t-green-500' : 'border-t-red-500'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-black text-lg">SAMPLE {test.sampleNumber}</h4>
                  <p className="text-[10px] opacity-50 uppercase tracking-widest">Seam: S-042</p>
                </div>
                {test.overallPass ? <CheckCircle2 className="text-green-500" /> : <AlertCircle className="text-red-500" />}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs"><span className="opacity-50">Peel:</span> <span className="font-mono">82 / 85 / 81 lbs</span></div>
                <div className="flex justify-between text-xs"><span className="opacity-50">Shear:</span> <span className="font-mono">124 / 121 / 128 lbs</span></div>
              </div>
              <button className="w-full mt-4 py-2 text-[10px] font-bold border border-industrial-border hover:bg-white/5">VIEW FULL REPORT</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RepairsList({ repairs, panels, welders, onAdd }: { repairs: Repair[], panels: Panel[], welders: Welder[], onAdd: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Repair/Patch Log</h2>
        <button 
          onClick={onAdd}
          className="bg-construction-orange text-black px-4 py-2 text-sm font-bold flex items-center gap-2"
        >
          <Plus size={18} /> LOG REPAIR
        </button>
      </div>

      <div className="industrial-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-industrial-border bg-white/5">
              <th className="p-4 industrial-header">Repair ID</th>
              <th className="p-4 industrial-header">Panel</th>
              <th className="p-4 industrial-header">Type</th>
              <th className="p-4 industrial-header">Welder</th>
              <th className="p-4 industrial-header">Size</th>
              <th className="p-4 industrial-header">Status</th>
              <th className="p-4 industrial-header">Date</th>
            </tr>
          </thead>
          <tbody>
            {repairs.length === 0 ? (
              <tr><td colSpan={7} className="p-12 text-center text-gray-500 italic">No repairs recorded.</td></tr>
            ) : (
              repairs.map(repair => (
                <tr key={repair.id} className="border-b border-industrial-border hover:bg-white/5 transition-colors">
                  <td className="p-4 font-mono text-sm font-bold text-construction-orange">{repair.repairNumber}</td>
                  <td className="p-4 text-xs font-mono">P-{panels.find(p => p.id === repair.panelId)?.panelNumber}</td>
                  <td className="p-4 text-sm">{repair.type}</td>
                  <td className="p-4 text-sm">{welders.find(w => w.id === repair.welderId)?.name}</td>
                  <td className="p-4 text-xs font-mono">{repair.size}</td>
                  <td className="p-4"><StatusBadge status={repair.status} /></td>
                  <td className="p-4 text-xs opacity-50">{new Date(repair.repairedAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WeldersList({ welders, onAdd }: { welders: Welder[], onAdd: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Welders & Personnel</h2>
        <button 
          onClick={onAdd}
          className="bg-construction-orange text-black px-4 py-2 text-sm font-bold flex items-center gap-2"
        >
          <Plus size={18} /> ADD PERSONNEL
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {welders.map(welder => (
          <div key={welder.id} className="industrial-card p-6 flex items-center gap-6">
            <div className="w-16 h-16 bg-white/5 flex items-center justify-center text-2xl font-black text-construction-orange border border-industrial-border">
              {welder.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h4 className="text-lg font-bold">{welder.name}</h4>
                <span className={`text-[10px] px-2 py-0.5 font-bold ${welder.status === 'Active' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                  {welder.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs font-mono opacity-50 mb-2">{welder.idNumber}</p>
              <div className="flex gap-2">
                {welder.certifications.map(c => (
                  <span key={c} className="text-[10px] bg-white/5 px-2 py-1 border border-industrial-border">{c}</span>
                ))}
              </div>
            </div>
            <button className="p-2 hover:bg-white/5 rounded">
              <MoreVertical size={18} className="opacity-50" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AsBuiltMap({ 
  panels, 
  seams, 
  repairs, 
  tests, 
  media, 
  mapMode, 
  setMapMode, 
  currentLocation,
  activeProjectId 
}: { 
  panels: Panel[], 
  seams: Seam[], 
  repairs: Repair[],
  tests: DestructiveTest[],
  media: MediaRecord[],
  mapMode: 'Drone' | 'Satellite' | 'Schematic',
  setMapMode: (mode: 'Drone' | 'Satellite' | 'Schematic') => void,
  currentLocation: { latitude: number, longitude: number, altitude?: number } | null,
  activeProjectId: string
}) {
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  // Find drone orthomosaic for this project
  const droneMap = useMemo(() => {
    return media.find(m => m.parentType === 'Project' && m.parentId === activeProjectId);
  }, [media, activeProjectId]);

  const droneMapUrl = useMemo(() => {
    if (droneMap) return URL.createObjectURL(droneMap.data);
    return null;
  }, [droneMap]);

  useEffect(() => {
    return () => {
      if (droneMapUrl) URL.revokeObjectURL(droneMapUrl);
    };
  }, [droneMapUrl]);

  // Handle Auto-Fallback
  useEffect(() => {
    if (mapMode === 'Drone' && !droneMap) {
      setMapMode('Satellite');
      setFallbackNotice('Drone Image Missing: Falling back to Satellite');
      setTimeout(() => setFallbackNotice(null), 3000);
    }
  }, [mapMode, droneMap, setMapMode]);

  // Map Center Logic
  const center = useMemo(() => {
    if (currentLocation) return [currentLocation.latitude, currentLocation.longitude] as [number, number];
    
    // Fallback to first available QC pin
    const firstPin = seams[0]?.location || repairs[0]?.locationGPS || tests[0]?.locationGPS;
    if (firstPin) return [firstPin.latitude, firstPin.longitude] as [number, number];
    
    return [35.65, -78.45] as [number, number]; // Default Clayton, NC
  }, [currentLocation, seams, repairs, tests]);

  // Mock Panel Layout projected to GPS (for demo purposes)
  const projectedPanels = useMemo(() => {
    return panels.map((p, i) => {
      const lat = center[0] + (i * 0.0001);
      const lng = center[1] + (i * 0.0001);
      return {
        ...p,
        coords: [
          [lat, lng],
          [lat + 0.0002, lng],
          [lat + 0.0002, lng + 0.0004],
          [lat, lng + 0.0004]
        ] as [number, number][]
      };
    });
  }, [panels, center]);

  return (
    <div className="h-[calc(100vh-12rem)] industrial-card relative overflow-hidden bg-[#050505]">
      {/* Map Mode Selector */}
      <div className="absolute top-4 right-4 z-[1000] flex gap-1 bg-industrial-gray/90 border border-industrial-border p-1 backdrop-blur-sm shadow-xl">
        {(['Drone', 'Satellite', 'Schematic'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setMapMode(mode)}
            className={cn(
              "px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-all",
              mapMode === mode 
                ? "bg-construction-orange text-black" 
                : "text-white/40 hover:text-white hover:bg-white/5"
            )}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Fallback Notification */}
      <AnimatePresence>
        {fallbackNotice && (
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-safety-yellow text-black px-4 py-2 text-xs font-bold shadow-2xl flex items-center gap-2"
          >
            <AlertCircle size={14} />
            {fallbackNotice}
          </motion.div>
        )}
      </AnimatePresence>

      <MapContainer 
        center={center} 
        zoom={18} 
        className={cn(
          "w-full h-full transition-colors duration-500",
          mapMode === 'Schematic' ? "bg-[#050505]" : "bg-black"
        )}
        zoomControl={false}
        attributionControl={false}
      >
        {/* Level 3: Schematic Grid (Custom Layer) */}
        {mapMode === 'Schematic' && (
          <div className="absolute inset-0 z-[400] pointer-events-none opacity-20 technical-grid"></div>
        )}

        {/* Level 2: Satellite */}
        {mapMode === 'Satellite' && (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
          />
        )}

        {/* Level 1: Drone Overlay */}
        {mapMode === 'Drone' && droneMapUrl && (
          <ImageOverlay
            url={droneMapUrl}
            bounds={[
              [center[0] - 0.005, center[1] - 0.005],
              [center[0] + 0.005, center[1] + 0.005]
            ]}
            opacity={0.9}
          />
        )}

        {/* Panels & Seams (Vector Layers) */}
        {projectedPanels.map(panel => (
          <Polygon 
            key={panel.id}
            positions={panel.coords}
            pathOptions={{
              fillColor: '#FF6B00',
              fillOpacity: mapMode === 'Schematic' ? 0.1 : 0.2,
              color: '#FF6B00',
              weight: 1,
              dashArray: mapMode === 'Schematic' ? '5, 5' : undefined
            }}
          >
            <Popup>
              <div className="font-mono text-xs">
                <div className="font-bold text-construction-orange">PANEL P-{panel.panelNumber}</div>
                <div className="opacity-60">Area: {panel.area} SF</div>
              </div>
            </Popup>
          </Polygon>
        ))}

        {/* Seam Lines (Vector) */}
        {projectedPanels.length > 1 && projectedPanels.slice(0, -1).map((p, i) => (
          <Polyline 
            key={`seam-${i}`}
            positions={[
              p.coords[2], // Top right of panel i
              p.coords[3]  // Bottom right of panel i
            ]}
            pathOptions={{
              color: '#FFC107',
              weight: 2,
              opacity: 0.8
            }}
          />
        ))}

        {/* QC Pins (Spatial Continuity) - Hidden in Schematic per requirements */}
        {mapMode !== 'Schematic' && seams.map(seam => seam.location && (
          <Marker 
            key={seam.id} 
            position={[seam.location.latitude, seam.location.longitude]}
            icon={L.divIcon({
              className: 'custom-div-icon',
              html: `<div class="w-3 h-3 bg-safety-yellow rounded-full border-2 border-black shadow-lg"></div>`,
              iconSize: [12, 12]
            })}
          >
            <Popup>
              <div className="font-mono text-xs">
                <div className="font-bold text-safety-yellow">SEAM {seam.seamNumber}</div>
                <div className="opacity-60">Status: {seam.status}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {mapMode !== 'Schematic' && repairs.map(repair => repair.locationGPS && (
          <Marker 
            key={repair.id} 
            position={[repair.locationGPS.latitude, repair.locationGPS.longitude]}
            icon={L.divIcon({
              className: 'custom-div-icon',
              html: `<div class="w-3 h-3 bg-red-500 rounded-full border-2 border-black shadow-lg animate-pulse"></div>`,
              iconSize: [12, 12]
            })}
          >
            <Popup>
              <div className="font-mono text-xs">
                <div className="font-bold text-red-500">REPAIR {repair.repairNumber}</div>
                <div className="opacity-60">Type: {repair.type}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Live GPS Position */}
        {currentLocation && (
          <Marker 
            position={[currentLocation.latitude, currentLocation.longitude]}
            icon={L.divIcon({
              className: 'custom-div-icon',
              html: `<div class="relative flex items-center justify-center">
                      <div class="absolute w-8 h-8 bg-blue-500/20 rounded-full animate-ping"></div>
                      <div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-xl"></div>
                    </div>`,
              iconSize: [16, 16]
            })}
          />
        )}
      </MapContainer>

      {/* Legend & Telemetry */}
      <div className="absolute bottom-4 left-4 z-[1000] space-y-2">
        <div className="bg-industrial-gray/90 border border-industrial-border p-3 backdrop-blur-sm">
          <h3 className="industrial-header mb-2">Legend</h3>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-construction-orange/20 border border-construction-orange"></div><span>Panel</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-safety-yellow rounded-full border border-black"></div><span>Seam</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full border border-black"></div><span>Repair</span></div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-[1000] text-[10px] font-mono opacity-50 bg-black/50 px-2 py-1">
        VIEWPORT: {mapMode.toUpperCase()} | GPS: {currentLocation ? 'LOCKED' : 'SEARCHING...'}
      </div>
    </div>
  );
}

// --- HELPERS ---

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function StatCard({ label, value, unit }: { label: string, value: string | number, unit?: string }) {
  return (
    <div className="text-right">
      <div className="industrial-header">{label}</div>
      <div className="text-2xl font-black">
        {value}
        {unit && <span className="text-xs font-normal opacity-50 ml-1">{unit}</span>}
      </div>
    </div>
  );
}

function ActivityItem({ icon, title, detail, time }: { icon: React.ReactNode, title: string, detail: string, time: string }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="p-2 bg-white/5 border border-industrial-border text-construction-orange">{icon}</div>
      <div className="flex-1">
        <div className="flex justify-between">
          <span className="text-sm font-bold">{title}</span>
          <span className="text-[10px] opacity-40 font-mono flex items-center gap-1"><Clock size={10} /> {time}</span>
        </div>
        <p className="text-xs opacity-60">{detail}</p>
      </div>
    </div>
  );
}

function AlertItem({ type, text }: { type: 'warning' | 'info' | 'error', text: string }) {
  const colors = {
    warning: 'text-safety-yellow',
    info: 'text-blue-400',
    error: 'text-red-500'
  };
  return (
    <div className="flex gap-3 items-center">
      <AlertCircle size={14} className={colors[type]} />
      <span className="text-xs">{text}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const colors = {
    Approved: 'bg-green-500/20 text-green-500',
    Pending: 'bg-safety-yellow/20 text-safety-yellow',
    Rejected: 'bg-red-500/20 text-red-500',
    Hold: 'bg-purple-500/20 text-purple-500'
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 font-bold ${colors[status]}`}>
      {status.toUpperCase()}
    </span>
  );
}

function MediaLog({ media, onDelete }: { media: MediaRecord[], onDelete: (id: string) => void }) {
  const [filter, setFilter] = useState<string>('All');
  const [search, setSearch] = useState('');

  const filteredMedia = useMemo(() => {
    return media.filter(m => {
      const matchesFilter = filter === 'All' || m.parentType === filter;
      const matchesSearch = m.parentId.toLowerCase().includes(search.toLowerCase()) || 
                            (m.description || '').toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [media, filter, search]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight text-white">MEDIA LOG</h2>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input 
              className="bg-white/5 border border-industrial-border pl-10 pr-4 py-2 text-sm outline-none focus:border-construction-orange w-64"
              placeholder="Search by ID or description..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="bg-industrial-gray border border-industrial-border px-4 py-2 text-sm outline-none text-white"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="All">All Categories</option>
            <option value="Panel">Panels</option>
            <option value="Seam">Seams</option>
            <option value="Repair">Repairs</option>
            <option value="DT">Destructive Tests</option>
          </select>
        </div>
      </div>

      {filteredMedia.length === 0 ? (
        <div className="industrial-card p-12 text-center opacity-50">
          <ImageIcon size={48} className="mx-auto mb-4 opacity-20" />
          <p>No media records found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredMedia.map((m) => (
            <MediaCard key={m.id} record={m} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

const MediaCard: React.FC<{ record: MediaRecord, onDelete: (id: string) => void }> = ({ record, onDelete }) => {
  const imageUrl = useMemo(() => URL.createObjectURL(record.data), [record.data]);
  
  useEffect(() => {
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  return (
    <div className="industrial-card group relative overflow-hidden flex flex-col">
      <div className="aspect-square relative overflow-hidden bg-black">
        <img 
          src={imageUrl} 
          className="w-full h-full object-cover transition-transform group-hover:scale-110" 
          referrerPolicy="no-referrer"
          alt={record.description}
        />
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
          <button 
            onClick={() => onDelete(record.id)}
            className="p-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            <Trash2 size={20} />
          </button>
        </div>
        <div className="absolute top-2 left-2 px-2 py-1 bg-black/80 text-[10px] font-bold text-construction-orange border border-construction-orange/30">
          {record.parentType}
        </div>
      </div>
      <div className="p-3 space-y-1">
        <div className="flex justify-between items-start">
          <span className="text-xs font-bold text-white">{record.parentId}</span>
          <span className="text-[10px] opacity-40 font-mono">{new Date(record.timestamp).toLocaleDateString()}</span>
        </div>
        {record.description && <p className="text-[10px] opacity-60 line-clamp-2">{record.description}</p>}
        {record.location && (
          <div className="text-[9px] opacity-40 flex items-center gap-1">
            <MapIcon size={8} /> {record.location.latitude.toFixed(4)}, {record.location.longitude.toFixed(4)}
          </div>
        )}
      </div>
    </div>
  );
}

function DroneFleet({ drones, media, panels, seams, onAddMedia }: { drones: Drone[], media: MediaRecord[], panels: Panel[], seams: Seam[], onAddMedia: (record: MediaRecord) => Promise<void> }) {
  const [activeDrone, setActiveDrone] = useState<string>(drones[0]?.id || '');
  const [ingesting, setIngesting] = useState(false);

  const handleDroneMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIngesting(true);
    for (const file of Array.from(files) as File[]) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const blob = new Blob([event.target?.result as ArrayBuffer], { type: file.type });
        
        // Parse EXIF
        EXIF.getData(file as any, function(this: any) {
          try {
            const lat = EXIF.getTag(this, "GPSLatitude");
            const latRef = EXIF.getTag(this, "GPSLatitudeRef") || 'N';
            const lon = EXIF.getTag(this, "GPSLongitude");
            const lonRef = EXIF.getTag(this, "GPSLongitudeRef") || 'E';
            const alt = EXIF.getTag(this, "GPSAltitude");
            
            const toDecimal = (gps: any, ref: string) => {
              if (!gps || !Array.isArray(gps)) return null;
              let dec = gps[0] + gps[1] / 60 + gps[2] / 3600;
              if (ref === 'S' || ref === 'W') dec = -dec;
              return dec;
            };

            const latitude = toDecimal(lat, latRef);
            const longitude = toDecimal(lon, lonRef);
            const altitude = alt ? parseFloat(alt) : undefined;

            const record: MediaRecord = {
              id: Math.random().toString(36).substr(2, 9),
              timestamp: new Date().toISOString(),
              data: blob,
              parentType: 'Panel',
              parentId: 'DRONE_INGEST',
              description: `Drone Ingest: ${file.name}`,
              droneId: activeDrone,
              location: latitude && longitude ? { latitude, longitude, altitude } : undefined
            };

            onAddMedia(record);
          } catch (exifErr) {
            console.error("EXIF Parsing failed for", file.name, exifErr);
            // Still add the record without location if EXIF fails
            const record: MediaRecord = {
              id: Math.random().toString(36).substr(2, 9),
              timestamp: new Date().toISOString(),
              data: blob,
              parentType: 'Panel',
              parentId: 'DRONE_INGEST',
              description: `Drone Ingest: ${file.name} (EXIF FAILED)`,
              droneId: activeDrone
            };
            onAddMedia(record);
          }
        });
      };
      reader.readAsArrayBuffer(file);
    }
    setIngesting(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">DRONE FLEET HUB</h2>
          <p className="text-xs text-white/40 font-mono uppercase tracking-widest mt-1">Fleet Management & Media Ingest</p>
        </div>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 bg-construction-orange px-4 py-2 text-sm font-bold text-black hover:bg-construction-orange/90 cursor-pointer transition-all">
            <Upload size={18} />
            <span>{ingesting ? 'INGESTING...' : 'INGEST DRONE MEDIA'}</span>
            <input type="file" multiple accept="image/*" className="hidden" onChange={handleDroneMediaUpload} disabled={ingesting} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {drones.map(drone => (
          <div 
            key={drone.id} 
            onClick={() => setActiveDrone(drone.id)}
            className={cn(
              "industrial-card p-6 cursor-pointer transition-all border-2",
              activeDrone === drone.id ? "border-construction-orange bg-construction-orange/5" : "border-industrial-border hover:border-white/20"
            )}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/5 border border-industrial-border text-construction-orange">
                <Plane size={24} />
              </div>
              <div className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest",
                drone.status === 'Active' ? "bg-green-500/20 text-green-500" : "bg-purple-500/20 text-purple-500"
              )}>
                {drone.status}
              </div>
            </div>
            <h3 className="text-lg font-bold text-white">{drone.model}</h3>
            <p className="text-xs font-mono text-white/40">{drone.serialNumber}</p>
            
            <div className="mt-6 pt-6 border-t border-industrial-border grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-mono text-white/30 uppercase">Media Count</div>
                <div className="text-sm font-bold text-white">{media.filter(m => m.droneId === drone.id).length}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-white/30 uppercase">Last Sync</div>
                <div className="text-sm font-bold text-white">Today</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="industrial-card p-6">
        <h3 className="industrial-header mb-6">Recent Drone Ingests</h3>
        <div className="grid grid-cols-6 gap-4">
          {media.filter(m => m.droneId).slice(0, 12).map(m => (
            <DroneMediaThumbnail key={m.id} record={m} droneModel={drones.find(d => d.id === m.droneId)?.model || 'Unknown'} />
          ))}
        </div>
      </div>
    </div>
  );
}

const DroneMediaThumbnail: React.FC<{ record: MediaRecord, droneModel: string }> = ({ record, droneModel }) => {
  const imageUrl = useMemo(() => URL.createObjectURL(record.data), [record.data]);
  
  useEffect(() => {
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  return (
    <div className="aspect-square relative group border border-industrial-border overflow-hidden">
      <img src={imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
        <span className="text-[8px] font-bold text-construction-orange">{droneModel}</span>
        <span className="text-[8px] text-white/60 mt-1">{record.location?.latitude.toFixed(4)}, {record.location?.longitude.toFixed(4)}</span>
      </div>
    </div>
  );
}

function VisionHUD({ 
  currentLocation, 
  seams, 
  repairs, 
  tests, 
  media,
  orientation 
}: { 
  currentLocation: { latitude: number, longitude: number, altitude?: number } | null,
  seams: Seam[],
  repairs: Repair[],
  tests: DestructiveTest[],
  media: MediaRecord[],
  orientation: { alpha: number, beta: number, gamma: number }
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [fov] = useState(60); // Field of view in degrees

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera error:", err);
      }
    }
    startCamera();
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const nearbyEntities = useMemo(() => {
    if (!currentLocation) return [];
    
    const all = [
      ...seams.filter(s => s.location).map(s => ({ ...s, type: 'Seam', gps: s.location!, label: s.seamNumber })),
      ...repairs.filter(r => r.locationGPS).map(r => ({ ...r, type: 'Repair', gps: r.locationGPS!, label: r.repairNumber })),
      ...tests.filter(t => t.locationGPS).map(t => ({ ...t, type: 'DT', gps: t.locationGPS!, label: t.sampleNumber }))
    ];

    return all.map(e => {
      const dist = getDistance(currentLocation.latitude, currentLocation.longitude, e.gps.latitude, e.gps.longitude);
      const bearing = getBearing(currentLocation.latitude, currentLocation.longitude, e.gps.latitude, e.gps.longitude);
      return { ...e, distance: dist, bearing };
    }).filter(e => e.distance <= 50);
  }, [currentLocation, seams, repairs, tests]);

  const getScreenX = (bearing: number) => {
    let diff = bearing - orientation.alpha;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    
    const x = (diff / (fov / 2)) * 50 + 50;
    return x;
  };

  const getScreenY = (distance: number) => {
    return 80 - (distance / 50) * 40;
  };

  return (
    <div className="fixed inset-0 bg-black z-30 overflow-hidden">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className="absolute inset-0 w-full h-full object-cover opacity-60"
      />
      
      {/* Telemetry Overlays */}
      <div className="absolute top-20 left-4 font-mono text-[10px] text-construction-orange bg-black/40 p-2 border border-construction-orange/30">
        <div>LAT: {currentLocation?.latitude.toFixed(6)}</div>
        <div>LON: {currentLocation?.longitude.toFixed(6)}</div>
        <div>ALT: {currentLocation?.altitude?.toFixed(1)}m</div>
      </div>

      <div className="absolute top-20 right-4 font-mono text-[10px] text-construction-orange bg-black/40 p-2 border border-construction-orange/30 text-right">
        <div>PITCH: {orientation.beta.toFixed(1)}°</div>
        <div>ROLL: {orientation.gamma.toFixed(1)}°</div>
        <div>YAW: {orientation.alpha.toFixed(1)}°</div>
      </div>

      {/* Compass Strip */}
      <div className="absolute top-32 left-1/2 -translate-x-1/2 w-64 h-8 border-x border-construction-orange/50 flex items-center justify-center overflow-hidden">
        <div className="relative w-full h-full">
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-construction-orange z-10" />
           <div 
             className="absolute top-0 flex gap-8 transition-transform duration-100 whitespace-nowrap"
             style={{ transform: `translateX(${-orientation.alpha * 2}px)` }}
           >
             {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
               <div key={deg} className="flex flex-col items-center w-8">
                 <div className="text-[8px] text-white font-bold">{deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : deg}</div>
                 <div className="w-px h-2 bg-white/30" />
               </div>
             ))}
           </div>
        </div>
      </div>

      {/* AR Pins */}
      {nearbyEntities.map((e) => {
        const x = getScreenX(e.bearing);
        const isVisible = x > -20 && x < 120;
        
        if (!isVisible) return null;

        const color = e.type === 'DT' ? (e.overallPass ? 'bg-green-500' : 'bg-red-500') :
                      e.type === 'Seam' ? 'bg-construction-orange' :
                      (e.status === 'Pending' ? 'bg-red-500 animate-pulse' : 'bg-green-500');

        return (
          <motion.div
            key={`${e.type}-${e.id}`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-40"
            style={{ left: `${x}%`, top: `${getScreenY(e.distance)}%` }}
            onClick={() => setSelectedEntity(e)}
          >
            <div className="flex flex-col items-center">
              <div className={cn("px-2 py-1 text-[8px] font-bold text-black border border-black/20 mb-1", color)}>
                {e.label}
              </div>
              <div className={cn("w-3 h-3 rounded-full border-2 border-white shadow-lg", color)} />
              <div className="text-[8px] text-white font-mono bg-black/40 px-1 mt-1">
                {e.distance.toFixed(1)}m
              </div>
            </div>
          </motion.div>
        );
      })}

      {/* Quick Look Card */}
      <AnimatePresence>
        {selectedEntity && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-24 left-4 right-4 bg-industrial-gray/90 backdrop-blur border border-construction-orange/50 p-4 z-50"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-[10px] text-construction-orange font-bold uppercase tracking-widest">{selectedEntity.type} DETAILS</div>
                <div className="text-xl font-bold text-white">{selectedEntity.label}</div>
              </div>
              <button onClick={() => setSelectedEntity(null)} className="p-1 text-white/50 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="flex gap-4">
              <div className="w-24 h-24 bg-black border border-industrial-border overflow-hidden">
                {media.find(m => m.parentId === selectedEntity.id) ? (
                  <EntityThumbnail record={media.find(m => m.parentId === selectedEntity.id)!} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-20">
                    <ImageIcon size={24} />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2 text-[10px] font-mono text-white/80">
                <div className="flex justify-between border-b border-white/10 pb-1">
                  <span>DISTANCE:</span>
                  <span className="text-construction-orange">{selectedEntity.distance.toFixed(1)}m</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-1">
                  <span>BEARING:</span>
                  <span>{selectedEntity.bearing.toFixed(1)}°</span>
                </div>
                {selectedEntity.type === 'Seam' && (
                  <div className="flex justify-between border-b border-white/10 pb-1">
                    <span>STATUS:</span>
                    <span className={cn(selectedEntity.status === 'Approved' ? 'text-green-500' : 'text-yellow-500')}>{selectedEntity.status}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions */}
      {!currentLocation && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 p-8 text-center">
          <div className="space-y-4">
            <AlertCircle className="mx-auto text-construction-orange" size={48} />
            <div className="text-white font-bold">GPS LOCK REQUIRED</div>
            <p className="text-xs text-white/60">Vision HUD requires active high-precision GPS to calculate spatial offsets.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function EntityThumbnail({ record }: { record: MediaRecord }) {
  const imageUrl = useMemo(() => URL.createObjectURL(record.data), [record.data]);
  useEffect(() => {
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);
  return <img src={imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />;
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

function getBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const λ1 = lon1 * Math.PI/180;
  const λ2 = lon2 * Math.PI/180;

  const y = Math.sin(λ2-λ1) * Math.cos(φ2);
  const x = Math.cos(φ1)*Math.sin(φ2) -
          Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1);
  const θ = Math.atan2(y, x);
  return (θ*180/Math.PI + 360) % 360;
}

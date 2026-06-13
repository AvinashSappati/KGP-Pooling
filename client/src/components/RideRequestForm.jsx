import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const HALL_NODES = ["RP Hall", "BC Roy Hall", "RK Hall", "Gokhale Hall", "MS Hall", "LLR Hall", "MMM Hall", "LBS Hall", "Patel Hall", "Nehru Hall", "Azad Hall", "BRH", "SNVH Hall", "MT Hall", "VGH", "VSRC 2", "VSRC", "SBP 1&2", "ABV Hall", "SNIG Hall", "RLB Hall", "VS Hall", "HJB & JCB Hall"];
const OUTSTATION_NODES = ["Main Gate", "KGP Railway Station", "Hijli Railway Station", "Sealdah Railway Station", "Howrah Railway Station", "Kolkata Airport (CCU)"];

const RideRequestForm = ({ currentUser, refreshData }) => {
  const [direction, setDirection] = useState('leaving'); 
  const [formData, setFormData] = useState({
    originNode: HALL_NODES[4], 
    destinationNode: OUTSTATION_NODES[1], 
    targetDepartureTime: '',
    flexibilityMinutes: 20,
    luggageSize: 'none',
    vehiclePreference: 'ANY',
    genderPreference: 'none'
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (direction === 'leaving') setFormData(prev => ({ ...prev, originNode: HALL_NODES[4], destinationNode: OUTSTATION_NODES[1] }));
    else setFormData(prev => ({ ...prev, originNode: OUTSTATION_NODES[1], destinationNode: HALL_NODES[4] }));
  }, [direction]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.targetDepartureTime) return toast.error("Select departure time!");
    const finalUserId = currentUser?._id || currentUser?.id;
    if (!finalUserId) return toast.error("Please login.");

    setLoading(true);
    try {
      const response = await fetch(`https://kgp-pooling.onrender.com/api/intents/request-ride`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: finalUserId, 
          fromNode: formData.originNode, 
          toNode: formData.destinationNode, 
          departureTime: formData.targetDepartureTime,
          flexibilityMinutes: Number(formData.flexibilityMinutes),
          luggageSize: formData.luggageSize,
          vehiclePreference: formData.vehiclePreference,
          gender: currentUser.gender, // Pulled straight from user profile
          genderPreference: formData.genderPreference
        })
      });
      const data = await response.json();
      
      if (response.status === 400) {
        toast.error(data.message);
      } else if (data.poolFound) {
        toast.success("Pool suggested : please check your suggestions.");
        refreshData(); 
      } else {
        toast.success(data.message);
        refreshData(); 
      }
    } catch (error) { 
      toast.error("Engine failed."); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black text-slate-900">Broadcast Intent</h2>
        <div className="bg-slate-100 p-1 rounded-lg flex text-xs font-bold">
          <button type="button" onClick={() => setDirection('leaving')} className={`px-3 py-1 rounded-md transition-all ${direction === 'leaving' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Leaving</button>
          <button type="button" onClick={() => setDirection('returning')} className={`px-3 py-1 rounded-md transition-all ${direction === 'returning' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Returning</button>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <select className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-800" value={formData.originNode} onChange={e => setFormData({...formData, originNode: e.target.value})}>
            {(direction === 'leaving' ? HALL_NODES : OUTSTATION_NODES).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="self-center font-bold text-slate-400">➔</span>
          <select className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-800" value={formData.destinationNode} onChange={e => setFormData({...formData, destinationNode: e.target.value})}>
            {(direction === 'leaving' ? OUTSTATION_NODES : HALL_NODES).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div className="flex gap-2">
          <input type="datetime-local" className="flex-[2] bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none" value={formData.targetDepartureTime} onChange={e => setFormData({...formData, targetDepartureTime: e.target.value})} required />
          <select className="flex-[1] bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none" value={formData.flexibilityMinutes} onChange={e => setFormData({...formData, flexibilityMinutes: Number(e.target.value)})}>
            <option value={10}>±10m</option><option value={20}>±20m</option><option value={30}>±30m</option>
            <option value={60}>±1h</option> 
          </select>
        </div>

        <div className="flex gap-2">
          <select className="flex-[1] bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none" value={formData.luggageSize} onChange={e => setFormData({...formData, luggageSize: e.target.value})}>
            <option value="none">No Luggage</option>
            <option value="backpack">Backpack</option>
            <option value="medium">Medium Bag</option>
            <option value="large">Large Suitcase</option>
          </select>
          <select className="flex-[1] bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none" value={formData.vehiclePreference} onChange={e => setFormData({...formData, vehiclePreference: e.target.value})}>
            <option value="ANY">Any Vehicle</option>
            <option value="TOTO">Toto / Auto</option>
            <option value="SEDAN">Sedan</option>
            <option value="SUV">SUV</option>
          </select>
        </div>

        <div>
          <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none" value={formData.genderPreference} onChange={e => setFormData({...formData, genderPreference: e.target.value})}>
            <option value="none">Ride Preference: No Preference</option>
            <option value="prefer_same_gender">Prefer Same Gender</option>
            <option value="same_gender_only">Strictly Same Gender</option>
          </select>
        </div>

        <button type="submit" disabled={loading || !currentUser} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold transition-all active:scale-95 text-sm shadow-md mt-2">
          {loading ? "Calculating..." : "Find Matches"}
        </button>
      </form>
    </div>
  );
};

export default RideRequestForm;
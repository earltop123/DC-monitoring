import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('your-supabase-url', 'your-supabase-key');

function InvestorDetail() {
  const { id } = useParams();
  const [vendors, setVendors] = useState([]);
  const [unassignedVendors, setUnassignedVendors] = useState([]);
  const [newVendor, setNewVendor] = useState({ name: '', packs: 0 });

  // Fetch vendors and unassigned vendors
  useEffect(() => {
    async function fetchVendors() {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, packs_sold')
        .eq('investor_id', id);
      if (error) console.error(error);
      else setVendors(data);
    }
    async function fetchUnassignedVendors() {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name')
        .is('investor_id', null);
      if (error) console.error(error);
      else setUnassignedVendors(data);
    }
    fetchVendors();
    fetchUnassignedVendors();
  }, [id]);

  // Update packs sold
  const updatePacksSold = async (vendorId, packs) => {
    const { error } = await supabase
      .from('vendors')
      .update({ packs_sold: packs })
      .eq('id', vendorId);
    if (error) console.error(error);
    else setVendors(vendors.map(v => (v.id === vendorId ? { ...v, packs_sold: packs } : v)));
  };

  // Add new vendor
  const addVendor = async () => {
    const { error } = await supabase
      .from('vendors')
      .insert({ name: newVendor.name, packs_sold: newVendor.packs, investor_id: id });
    if (error) console.error(error);
    else {
      setVendors([...vendors, { name: newVendor.name, packs_sold: newVendor.packs }]);
      setNewVendor({ name: '', packs: 0 });
    }
  };

  // Assign existing vendor
  const assignVendor = async (vendorId) => {
    const { error } = await supabase
      .from('vendors')
      .update({ investor_id: id })
      .eq('id', vendorId);
    if (error) console.error(error);
    else {
      const vendor = unassignedVendors.find(v => v.id === vendorId);
      setVendors([...vendors, { ...vendor, packs_sold: 0 }]);
      setUnassignedVendors(unassignedVendors.filter(v => v.id !== vendorId));
    }
  };

  return (
    <div>
      <h1>Investor Detail</h1>

      {/* Vendor List */}
      <h2>Vendors</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Packs Sold</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map(vendor => (
            <tr key={vendor.id}>
              <td>{vendor.name}</td>
              <td>
                <input
                  type="number"
                  value={vendor.packs_sold}
                  onChange={(e) => updatePacksSold(vendor.id, parseInt(e.target.value))}
                />
              </td>
              <td>
                <button onClick={() => updatePacksSold(vendor.id, vendor.packs_sold)}>Save</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add New Vendor */}
      <h2>Add New Vendor</h2>
      <input
        type="text"
        placeholder="Name"
        value={newVendor.name}
        onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
      />
      <input
        type="number"
        placeholder="Packs Sold"
        value={newVendor.packs}
        onChange={(e) => setNewVendor({ ...newVendor, packs: parseInt(e.target.value) })}
      />
      <button onClick={addVendor}>Add</button>

      {/* Assign Existing Vendors */}
      <h2>Assign Existing Vendors</h2>
      <ul>
        {unassignedVendors.map(vendor => (
          <li key={vendor.id}>
            {vendor.name} <button onClick={() => assignVendor(vendor.id)}>Assign</button>
          </li>
        ))}
      </ul>

      {/* Generate Report */}
      <button onClick={() => window.open(`/investors/${id}/report`, '_blank')}>
        View Report
      </button>
    </div>
  );
}

export default InvestorDetail;
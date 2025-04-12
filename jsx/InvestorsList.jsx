import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';

// Replace with your Supabase URL and public anon key
const supabase = createClient('your-supabase-url', 'your-supabase-key');

function InvestorsList() {
  const [investors, setInvestors] = useState([]);

  useEffect(() => {
    async function fetchInvestors() {
      const { data, error } = await supabase
        .from('investor_summary')
        .select('*');
      if (error) {
        console.error('Error fetching investors:', error);
      } else {
        setInvestors(data.map(investor => ({
          ...investor,
          total_cut: investor.total_packs_sold * 13.50 // Assuming $13.50 per pack
        })));
      }
    }
    fetchInvestors();
  }, []);

  return (
    <div>
      <h1>Investors</h1>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Vendors</th>
            <th>Packs Sold</th>
            <th>Total Cut</th>
          </tr>
        </thead>
        <tbody>
          {investors.map(investor => (
            <tr key={investor.id}>
              <td>
                <Link to={`/investors/${investor.id}`}>{investor.name}</Link>
              </td>
              <td>{investor.number_of_vendors}</td>
              <td>{investor.total_packs_sold}</td>
              <td>${investor.total_cut.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default InvestorsList;
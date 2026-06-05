import React from 'react'
import Head from 'next/head'
// import Link from 'next/link'
// import Image from 'next/image'

import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../utils/trpc";
import { useAuth } from '../contexts/AuthContext';

export default function HomePage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { getWebToken } = useAuth();

  const [consoles, setConsoles] = React.useState<any[]>([])


  if(consoles.length === 0){
    // queryClient.fetchQuery(trpc.smartglass_consoles_list.queryOptions({ uhs: getWebToken().uhs, token: getWebToken().token }))
    queryClient.fetchQuery(trpc.smartglass_consoles_list.queryOptions({ uhs: '', token: '' }))
      .then((consolesResponse) => {
        setConsoles(consolesResponse.data.result)
      })
      .catch((error) => {
        console.error('Error fetching data:', error);
      });
  }

  return (
    <React.Fragment>
      <Head>
        <title>Greenlight - My Consoles</title>
      </Head>

      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 animate-fade-in-up">
          <h2 className="text-2xl font-bold text-white mb-1">My Consoles</h2>
          <p className="text-white/40 text-sm">Manage and stream from your home consoles</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8 animate-fade-in-up delay-100 p-5">
        {consoles.map((console) => (
          <div key={console.id} className="glass rounded-2xl p-5 flex flex-col gap-4 hover:border-[#107C10]/20 transition-all duration-300 group animate-fade-in-up">
            <div className="flex items-start justify-between">

              <div className="flex items-center gap-3.5">
                <div>
                  <h3 className="text-white font-semibold text-base">{console.name}</h3>
                  <p className="text-white/40 text-xs mt-0.5">{console.type}</p>
                </div>
              </div>

              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${console.powerState === 'On' ? 'bg-[#107C10]/20 text-[#107C10] border border-[#107C10]/30' : 'bg-white/5 text-white/35 border border-white/10'}`}>
                {console.powerState === 'On' ? 'Online' : 'Standby'}
              </div>

            </div>
            <div className="flex gap-2 pt-1">
              <button data-focusable="true" className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 bg-[#107C10] hover:bg-[#15a015] text-white hover:shadow-[0_0_15px_rgba(16,124,16,0.35)] active:scale-95">
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"></path>
                </svg>
                  Stream
              </button>
              {/* <button data-focusable="true" className="flex items-center justify-center w-10 h-10 glass hover:bg-white/10 text-white/40 hover:text-white rounded-xl transition-all duration-200">
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
              </button> */}
            </div>
            
        </div>
        ))}

      </div>
    </React.Fragment>
  )
}

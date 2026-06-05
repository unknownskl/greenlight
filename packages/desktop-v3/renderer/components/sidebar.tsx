import { useAuth } from "../contexts/AuthContext";
import Link from 'next/link'
import { useTranslations } from 'next-intl';

import HomeIcon from '@heroicons/react/24/outline/HomeIcon'
import CloudIcon from '@heroicons/react/24/outline/CloudIcon'
import ArrowIcon from '@heroicons/react/24/outline/ArrowRightOnRectangleIcon'
import WrenchScrewdriverIcon from '@heroicons/react/24/outline/WrenchScrewdriverIcon'
// import StopIcon from '@heroicons/react/24/outline/StopIcon'

export default function Sidebar() {
  const t = useTranslations('Sidebar');
  const { authState, logout } = useAuth();

  function handleLogout() {
    if(confirm("Are you sure you want to logout?")) {
      return logout();
    }
  }

  return (
    <aside className="w-64 h-full flex flex-col bg-[#0d0d0d] border-r border-white/5 relative z-20">
    
        <div className="h-full overflow-y-auto">
            <div className="p-6 md:p-8 max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-1">Greenlight</h2>
                <p className="text-white/40 text-sm">{ (authState?.webToken?.data.DisplayClaims?.xui?.[0] as any)?.gtg || 'Gamertag'}</p>
                <p className="text-white/70 text-sm"><Link href="#" onClick={handleLogout}>{t('logout')}</Link></p>
                </div>
            </div>

            <ul className="menu rounded-box w-full">
                <li>
                    <Link href="/home/">
                        <HomeIcon className="size-5" />
                        {t('home')}
                    </Link>
                </li>
                <li>
                    <Link href="/consoles/">
                        <ArrowIcon className="size-5" />
                        {t('myConsoles')}
                    </Link>
                </li>
                <li>
                    <Link href="/xcloud/" aria-disabled={true} className="cursor-not-allowed opacity-50">
                        <CloudIcon className="size-5" />
                        {t('xcloud')}
                    </Link>
                </li>
                <li>
                    <Link href="/settings/" aria-disabled={true} className="cursor-not-allowed opacity-50">
                        <WrenchScrewdriverIcon className="size-5" />
                        {t('settings')}
                    </Link>
                </li>
                {/* <li className="bg-red-900">
                    <Link href="/settings/" aria-disabled={true} className="cursor-not-allowed opacity-50">
                        <StopIcon className="size-5" />
                        Exit
                    </Link>
                </li> */}
            </ul>

        </div>

    </aside>
  )
}
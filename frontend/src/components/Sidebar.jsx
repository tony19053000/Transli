import React from 'react';

export default function Sidebar({ activePage, setActivePage }) {
  // Navigation options aligned completely with the new UI design
  const menuItems = [
    { id: 'quick', label: 'Quick Translate', icon: 'translate' },
    { id: 'live', label: 'Live Conversation', icon: 'settings_voice' },
    { id: 'file', label: 'File & Visual Translation', icon: 'description' },
    { id: 'history', label: 'History & Downloads', icon: 'history' },
  ];

  const bottomItems = [
    { id: 'settings', label: 'Settings', icon: 'settings' },
    { id: 'documentation', label: 'Product Guide', icon: 'menu_book' },
  ];

  const renderLink = (item) => {
    const isActive = activePage === item.id;
    if (isActive) {
      return (
        <a
          key={item.id}
          href="#"
          onClick={(e) => { e.preventDefault(); setActivePage(item.id); }}
          className="flex items-center gap-3 px-4 py-3 text-[#ADC6FF] bg-[#282A2E] rounded-lg font-semibold scale-95 active:opacity-80 transition-all duration-200 group"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
          <span>{item.label}</span>
        </a>
      );
    }
    return (
      <a
        key={item.id}
        href="#"
        onClick={(e) => { e.preventDefault(); setActivePage(item.id); }}
        className="flex items-center gap-3 px-4 py-3 text-[#C2C6D6] hover:text-[#E2E2E8] hover:bg-[#282A2E]/50 transition-colors duration-200 rounded-lg group scale-95 active:opacity-80"
      >
        <span className="material-symbols-outlined group-hover:scale-110 transition-transform">{item.icon}</span>
        <span>{item.label}</span>
      </a>
    );
  };

  return (
    <aside className="fixed left-0 top-0 h-screen flex flex-col p-4 bg-[#0C0E12] dark:bg-[#0C0E12] w-64 border-r border-[#C2C6D6]/15 font-manrope text-sm tracking-tight z-50">
      <div className="mb-8 px-2 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(173,198,255,0.2)] border border-primary/20">
          <img src="/favicon.png" alt="Transli Logo" className="w-full h-full object-cover" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tighter text-[#E2E2E8]">Transli</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary/60 font-bold">Premium Workspace</p>
        </div>
      </div>
      
      <nav className="flex-1 space-y-1">
        {menuItems.map(renderLink)}
      </nav>

      <div className="mt-auto space-y-1 pt-4 border-t border-outline-variant/20">
        {bottomItems.map(renderLink)}
      </div>
    </aside>
  );
}

import React, { useState, createContext, useContext, ReactNode } from 'react';

const TabsContext = createContext<any>(null);

export function Tabs({ defaultValue, children }: { defaultValue: string; children: ReactNode }) {
  const [active, setActive] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ active, setActive }}>
      {children}
    </TabsContext.Provider>
  );
}

export function TabsList({ children }: { children: ReactNode }) {
  const { active, setActive } = useContext(TabsContext);
  return (
    <div className="flex space-x-2 border-b pb-2">
      {React.Children.map(children, (child: any) =>
        React.cloneElement(child, { active, setActive })
      )}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  active,
  setActive,
}: {
  value: string;
  children: ReactNode;
  active?: string;
  setActive?: (v: string) => void;
}) {
  const isActive = value === active;
  return (
    <button
      onClick={() => setActive?.(value)}
      className={`px-4 py-2 rounded-t-md font-semibold ${
        isActive ? 'bg-white border-t border-l border-r text-blue-500' : 'bg-gray-200 text-gray-600'
      }`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }: { value: string; children: ReactNode }) {
  const { active } = useContext(TabsContext);
  return active === value ? <div className="mt-4">{children}</div> : null;
}

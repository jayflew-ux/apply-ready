import { createContext, useContext, useState } from 'react';

const ChatCtx = createContext({ context: {}, setContext: () => {} });

export function ChatProvider({ children }) {
  const [context, setContext] = useState({});
  return <ChatCtx.Provider value={{ context, setContext }}>{children}</ChatCtx.Provider>;
}

export const useChatContext = () => useContext(ChatCtx);

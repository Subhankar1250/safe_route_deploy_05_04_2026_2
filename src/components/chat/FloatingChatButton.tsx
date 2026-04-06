import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";
import ChatInterface from './ChatInterface';

const FloatingChatButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const toggleChat = () => {
    if (!isOpen) {
      setIsOpen(true);
      setIsMinimized(false);
    } else {
      setIsOpen(false);
      setIsMinimized(false);
    }
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <Button
          onClick={toggleChat}
          className="fixed right-4 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90 md:right-6"
          style={{ bottom: "max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))" }}
          size="icon"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {/* Chat Interface - Mobile Responsive */}
      {isOpen && (
        <div className={`fixed z-50 transition-all duration-300 ease-in-out
          ${isMinimized 
            ? 'right-4 w-80 h-auto' 
            : 'top-0 bottom-0 right-0 left-0 md:bottom-4 md:right-4 md:top-auto md:left-auto md:w-96 md:h-[32rem]'
          }
        `}>
          <div
            className="relative h-full w-full"
            style={
              isMinimized
                ? { marginBottom: "max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))" }
                : {
                    paddingTop: "env(safe-area-inset-top, 0px)",
                    paddingBottom: "env(safe-area-inset-bottom, 0px)",
                  }
            }
          >
            {/* Close button for mobile */}
            <Button
              onClick={toggleChat}
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 z-10 md:hidden"
            >
              <X className="h-4 w-4" />
            </Button>

            <ChatInterface
              isMinimized={isMinimized}
              onToggleMinimize={toggleMinimize}
              className={`h-full w-full border-0 md:border md:rounded-lg md:shadow-lg ${
                isMinimized ? '' : 'rounded-none md:rounded-lg'
              }`}
            />
          </div>
        </div>
      )}

      {/* Overlay for mobile when chat is open */}
      {isOpen && !isMinimized && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={toggleChat}
        />
      )}
    </>
  );
};

export default FloatingChatButton;
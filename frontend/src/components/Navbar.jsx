import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Flame, PlusCircle, LayoutDashboard, LogOut, User, Sun, Moon, Mail } from 'lucide-react';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);

  const isVoterPage = location.pathname.startsWith('/poll/') && !location.pathname.includes('/results');
  const isSignupPage = location.pathname === '/signup';
  const isLoginPage = location.pathname === '/login';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'var(--header-bg)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-glass)',
      transition: 'background-color 0.3s ease, border-color 0.3s ease',
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '74px',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '14px',
            background: 'var(--gradient-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px var(--shadow-glow)',
            transition: 'transform 0.3s ease',
          }}>
            <Flame size={24} color="#ffffff" fill="#ffffff" style={{ opacity: 0.95 }} />
          </div>
          <div>
            <span style={{ fontSize: '1.35rem', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
              Poll<span className="brand-gradient">ify</span>
            </span>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
              Real-Time Polling
            </div>
          </div>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Theme Switcher Button: ONLY visible when user is logged in AND on internal dashboard/protected pages */}
          {user && !isVoterPage && !isSignupPage && !isLoginPage && (
            <button
              onClick={toggleTheme}
              className="btn btn-secondary btn-icon"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle theme"
              style={{
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {theme === 'dark' ? (
                <Sun size={20} color="#f59e0b" style={{ transition: 'transform 0.3s ease' }} />
              ) : (
                <Moon size={20} color="#7c3aed" style={{ transition: 'transform 0.3s ease' }} />
              )}
            </button>
          )}

          {isSignupPage ? (
            /* On Signup page: No extra auth or theme buttons */
            null
          ) : isVoterPage || isLoginPage ? (
            /* On Shared Voter page or Login page: ONLY show Sign Up button, NO profile icon or theme switcher */
            <Link to="/signup" className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.875rem' }}>
              Sign Up
            </Link>
          ) : user ? (
            /* Internal Dashboard & Protected Pages */
            <>
              <Link to="/dashboard" className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
                <LayoutDashboard size={18} />
                Dashboard
              </Link>
              <Link to="/create-poll" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
                <PlusCircle size={18} />
                Create Poll
              </Link>
              <div ref={profileRef} style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '10px',
                borderLeft: '1px solid var(--border-glass)'
              }}>
                <button
                  type="button"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  title="View Profile Details & Email"
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: 'rgba(6, 182, 212, 0.15)',
                    border: '2px solid var(--secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--secondary)',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    boxShadow: showProfileMenu ? '0 0 15px var(--shadow-glow)' : 'none'
                  }}
                >
                  {user.name ? user.name.charAt(0).toUpperCase() : <User size={18} />}
                </button>

                {showProfileMenu && (
                  <div style={{
                    position: 'absolute',
                    top: '48px',
                    right: 0,
                    width: '240px',
                    padding: '16px',
                    background: 'var(--card-bg)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid var(--border-glass-bright)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
                    zIndex: 200,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    {/* User Info Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'var(--gradient-brand)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '1rem',
                        flexShrink: 0
                      }}>
                        {user.name ? user.name.charAt(0).toUpperCase() : <User size={20} />}
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {user.name || 'User Account'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={user.email}>
                          <Mail size={12} color="var(--secondary)" />
                          {user.email}
                        </div>
                      </div>
                    </div>

                    <div style={{ height: '1px', background: 'var(--border-glass)' }}></div>

                    {/* Logout Button: Metallic Red ONLY when moving mouse near (hovering) or clicking */}
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleLogout();
                      }}
                      className="btn btn-metallic-hover-red"
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        padding: '10px 14px',
                        fontSize: '0.875rem'
                      }}
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Default non-logged in navigation */
            <>
              <Link to="/login" className="btn btn-secondary" style={{ padding: '8px 20px', fontSize: '0.875rem' }}>
                Login
              </Link>
              <Link to="/signup" className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.875rem' }}>
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

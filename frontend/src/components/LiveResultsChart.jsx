import React, { useState } from 'react';
import { Award, Zap, Radio, Crown, PieChart as PieIcon, BarChart2 } from 'lucide-react';

export const LiveResultsChart = ({ options = [], totalVotes = 0, wsStatus = 'CONNECTED' }) => {
  const [chartType, setChartType] = useState('bar'); // Default to Bar Chart view, with option to switch to Pie Chart
  const [hoverIndex, setHoverIndex] = useState(null);

  // Find highest vote count to highlight winner
  const maxVotes = Math.max(...options.map(o => o.votesCount), 0);

  const themeColors = [
    { main: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)', gradient: 'linear-gradient(90deg, #06b6d4 0%, #0284c7 100%)', label: 'Cyber Cyan' },
    { main: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.4)', gradient: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)', label: 'Electric Violet' },
    { main: '#ec4899', glow: 'rgba(236, 72, 153, 0.4)', gradient: 'linear-gradient(90deg, #ec4899 0%, #be185d 100%)', label: 'Magenta Pink' },
    { main: '#10b981', glow: 'rgba(16, 185, 129, 0.4)', gradient: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', label: 'Emerald Teal' },
    { main: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', gradient: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)', label: 'Amber Gold' },
    { main: '#f43f5e', glow: 'rgba(244, 63, 94, 0.4)', gradient: 'linear-gradient(90deg, #f43f5e 0%, #e11d48 100%)', label: 'Neon Rose' },
  ];

  const getWSBadgeStyle = () => {
    switch (wsStatus) {
      case 'CONNECTED':
        return { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)', text: 'var(--success)', label: 'LIVE SYNC' };
      case 'CONNECTING':
        return { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', text: 'var(--warning)', label: 'CONNECTING...' };
      default:
        return { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', text: 'var(--danger)', label: 'OFFLINE' };
    }
  };

  const wsStyle = getWSBadgeStyle();

  const renderPieChart = () => {
    if (totalVotes === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
          <PieIcon size={44} color="var(--secondary)" style={{ opacity: 0.5, marginBottom: '12px' }} />
          <p style={{ fontSize: '1rem', fontWeight: 600 }}>No votes recorded yet.</p>
          <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>Cast a vote to see the live pie chart visualization!</p>
        </div>
      );
    }

    let currentAngle = -Math.PI / 2; // Start from top (12 o'clock)
    const cx = 140;
    const cy = 140;
    const outerRadius = 110;
    const innerRadius = 60;

    const slices = options.map((opt, idx) => {
      const fraction = opt.votesCount / totalVotes;
      const angleSpan = fraction * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleSpan;
      currentAngle = endAngle;

      // Outer arc endpoints
      const x1 = cx + outerRadius * Math.cos(startAngle);
      const y1 = cy + outerRadius * Math.sin(startAngle);
      const x2 = cx + outerRadius * Math.cos(endAngle);
      const y2 = cy + outerRadius * Math.sin(endAngle);

      // Inner arc endpoints
      const x3 = cx + innerRadius * Math.cos(endAngle);
      const y3 = cy + innerRadius * Math.sin(endAngle);
      const x4 = cx + innerRadius * Math.cos(startAngle);
      const y4 = cy + innerRadius * Math.sin(startAngle);

      const largeArcFlag = angleSpan > Math.PI ? 1 : 0;

      let pathData = '';
      if (fraction >= 0.999) {
        // Full circle case
        pathData = `
          M ${cx - outerRadius}, ${cy}
          A ${outerRadius},${outerRadius} 0 1,0 ${cx + outerRadius},${cy}
          A ${outerRadius},${outerRadius} 0 1,0 ${cx - outerRadius},${cy}
          Z
          M ${cx - innerRadius}, ${cy}
          A ${innerRadius},${innerRadius} 0 1,1 ${cx + innerRadius},${cy}
          A ${innerRadius},${innerRadius} 0 1,1 ${cx - innerRadius},${cy}
          Z
        `;
      } else {
        pathData = `
          M ${x1} ${y1}
          A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}
          L ${x3} ${y3}
          A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}
          Z
        `;
      }

      const color = themeColors[idx % themeColors.length];
      const percentage = Math.round(fraction * 100);

      return {
        ...opt,
        percentage,
        pathData,
        color,
        fraction,
      };
    });

    const activeSlice = hoverIndex !== null ? slices[hoverIndex] : null;

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '32px',
        flexWrap: 'wrap',
        padding: '10px 0'
      }}>
        {/* SVG Pie/Doughnut Chart Display */}
        <div style={{
          position: 'relative',
          width: '280px',
          height: '280px',
          margin: '0 auto',
          flexShrink: 0
        }}>
          <svg width="280" height="280" viewBox="0 0 280 280">
            {slices.map((slice, idx) => (
              <path
                key={slice.id}
                d={slice.pathData}
                fill={slice.color.main}
                stroke="var(--card-bg)"
                strokeWidth="2.5"
                style={{
                  transition: 'all 0.25s ease',
                  cursor: 'pointer',
                  filter: hoverIndex === idx ? `drop-shadow(0 0 14px ${slice.color.main})` : 'none',
                  opacity: hoverIndex !== null && hoverIndex !== idx ? 0.65 : 1,
                  transform: hoverIndex === idx ? 'scale(1.04)' : 'scale(1)',
                  transformOrigin: '140px 140px'
                }}
                onMouseEnter={() => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            ))}
          </svg>

          {/* Doughnut Hole Center Content */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none',
            maxWidth: '110px'
          }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-main)', lineHeight: 1 }}>
              {activeSlice ? `${activeSlice.percentage}%` : totalVotes}
            </div>
            <div style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              color: activeSlice ? activeSlice.color.main : 'var(--secondary)',
              letterSpacing: '0.08em',
              marginTop: '4px',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {activeSlice ? activeSlice.text : 'TOTAL VOTES'}
            </div>
          </div>
        </div>

        {/* Option Legend Breakdown List */}
        <div style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {slices.map((slice, idx) => {
            const isHovered = hoverIndex === idx;
            const isWinner = maxVotes > 0 && slice.votesCount === maxVotes;

            return (
              <div
                key={slice.id}
                onMouseEnter={() => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: isHovered ? 'var(--card-bg-hover)' : 'var(--input-bg)',
                  border: isHovered ? `1.5px solid ${slice.color.main}` : '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-md)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  boxShadow: isHovered ? `0 4px 16px ${slice.color.glow}` : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  <span style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '4px',
                    background: slice.color.main,
                    boxShadow: `0 0 10px ${slice.color.glow}`,
                    flexShrink: 0
                  }}></span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {slice.text}
                  </span>
                  {isWinner && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      color: '#f59e0b',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      flexShrink: 0
                    }}>
                      <Crown size={11} /> TOP
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, marginLeft: '10px' }}>
                  <strong style={{ fontSize: '0.95rem', fontWeight: 800, color: slice.color.main }}>
                    {slice.percentage}%
                  </strong>
                  <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '10px' }}>
                    {slice.votesCount} {slice.votesCount === 1 ? 'vote' : 'votes'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderBarChart = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {options.map((opt, idx) => {
          const percentage = totalVotes > 0 ? Math.round((opt.votesCount / totalVotes) * 100) : 0;
          const isWinner = maxVotes > 0 && opt.votesCount === maxVotes;
          const colorObj = themeColors[idx % themeColors.length];

          return (
            <div key={opt.id} className="chart-bar-container">
              <div className="chart-bar-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', fontWeight: isWinner ? 800 : 600 }}>
                  {isWinner ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b', fontSize: '0.75rem', fontWeight: 800 }}>
                      <Crown size={14} /> LEADING
                    </span>
                  ) : (
                    <Award size={16} color="var(--text-dim)" />
                  )}
                  {opt.text}
                </span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>
                  {percentage}% ({opt.votesCount} {opt.votesCount === 1 ? 'vote' : 'votes'})
                </span>
              </div>

              <div className="chart-bar-track">
                <div 
                  className="chart-bar-fill" 
                  style={{
                    width: `${percentage}%`,
                    background: colorObj.gradient,
                    boxShadow: isWinner ? `0 0 18px ${colorObj.glow}` : 'none'
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Real-time Header & Chart View Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--border-glass)', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            background: wsStyle.bg,
            border: `1px solid ${wsStyle.border}`,
            color: wsStyle.text,
            fontSize: '0.75rem',
            fontWeight: 800,
            letterSpacing: '0.08em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {wsStatus === 'CONNECTED' ? <span className="pulse-dot"></span> : <Radio size={14} />}
            {wsStyle.label}
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Real-Time Feed
          </span>
        </div>

        {/* View Switcher: Pie Chart vs Bar Chart */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'inline-flex',
            background: 'var(--input-bg)',
            padding: '3px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-glass)'
          }}>
            <button
              onClick={() => setChartType('pie')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: chartType === 'pie' ? 'var(--gradient-brand)' : 'transparent',
                color: chartType === 'pie' ? '#ffffff' : 'var(--text-muted)',
                boxShadow: chartType === 'pie' ? '0 2px 8px var(--shadow-glow)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <PieIcon size={14} />
              Pie Chart
            </button>
            <button
              onClick={() => setChartType('bar')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: chartType === 'bar' ? 'var(--gradient-brand)' : 'transparent',
                color: chartType === 'bar' ? '#ffffff' : 'var(--text-muted)',
                boxShadow: chartType === 'bar' ? '0 2px 8px var(--shadow-glow)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <BarChart2 size={14} />
              Bar Chart
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
            <Zap size={18} color="var(--primary)" />
            <span>{totalVotes} {totalVotes === 1 ? 'Vote' : 'Votes'}</span>
          </div>
        </div>
      </div>

      {/* Render selected chart view */}
      {chartType === 'pie' ? renderPieChart() : renderBarChart()}
    </div>
  );
};

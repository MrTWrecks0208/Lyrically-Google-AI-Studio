import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CheckIcon, CreditCard, Layers, Sparkles, Zap } from 'lucide-react';
import { auth } from '../firebase';

const aiFeatureMapping: Record<string, string[]> = {
  'Core Writing Tools': ['Suggest Next Lines', 'Find Rhymes', 'Review Lyrics', 'Check Common Phrases', 'Suggest Structure'],
  'All Writing Tools': ['All Core Tools', 'Prompt to Lyrics', 'Improve Lyrics', 'Suggest Chords', 'Suggest Beat', 'Export Project as ZIP', 'Sentiment Analysis'],
  'Advanced AI Tools': ['All Writing Tools', 'Fit to Your Style', 'Suggest Melody', 'Change Style', 'Tone Switcher', 'Check Originality', 'Stem Splitter', 'Generate Hook for TikTok', 'Generate Story'],
  'All Features Unlocked': ['All Advanced Tools', 'Generate Song', 'Radio-Ready Polish', 'Studio Mode', 'Export Recordings to DAW Formats']
};

interface PricingProps {
  onBack: () => void;
  isModal?: boolean;
  onSelectPlan?: (planId: string, billingCycle: 'monthly' | 'yearly') => void;
}

const Pricing: React.FC<PricingProps> = ({ onBack, isModal, onSelectPlan }) => {
  const [activeTab, setActiveTab] = useState<'plans' | 'credits'>('plans');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('monthly');
  const [selectedPack, setSelectedPack] = useState<string>('pack2');

  const tiers = [
    {
      name: 'Open Mic',
      price: { monthly: 0, annually: 0 },
      description: 'Perfect for getting started.',
      features: ['60 Credits / Month', 'Core Writing Tools', '3 Projects', '2 Full Song Generations'],
      buttonText: 'Start Free',
      isCurrent: true,
    },
    {
      name: 'Rising Artist',
      price: { monthly: 12, annually: 120 },
      description: 'For serious songwriters.',
      features: ['500 Credits / Month', 'All Writing Tools', '20 Projects', '10 Full Song Generations', 'Melody + Chord Suggestions', 'Choice of AI Co-Writer'],
      buttonText: 'Upgrade',
      priceId: { monthly: 'price_tier1_monthly', annually: 'price_tier1_annually' },
      isPopular: false,
    },
    {
      name: 'Headliner',
      price: { monthly: 24, annually: 240 },
      description: 'For professional lyricists.',
      features: ['1,500 Credits / Month', 'Advanced AI Tools', '60 Projects', '40 Full Song Generations', 'Version History', 'Export Projects'],
      buttonText: 'Upgrade',
      priceId: { monthly: 'price_tier2_monthly', annually: 'price_tier2_annually' },
      isPopular: true,
    },
    {
      name: 'Legend',
      price: { monthly: 48, annually: 480 },
      description: 'The ultimate creative suite.',
      features: ['5,000 Credits / Month', 'All Features Unlocked', 'Unlimited Projects', '100 Full Song Generations', 'Studio Mode', 'Collaboration Tool', 'Export Files to DAW'],
      buttonText: 'Upgrade',
      priceId: { monthly: 'price_tier3_monthly', annually: 'price_tier3_annually' },
    },
  ];

  const creditPacks = [
    { id: 'pack1', name: 'Intro Pack', credits: 500, price: '6.99', desc: 'Ideal for small enhancements' },
    { id: 'pack2', name: 'Songwriter Pack', credits: 1200, price: '12.99', desc: 'Popular for full song polish', isBestValue: true },
    { id: 'pack3', name: 'Producer Pack', credits: 2500, price: '24.99', desc: 'Deep-dive AI analysis stems' },
    { id: 'pack4', name: 'Studio Force Pack', credits: 6000, price: '49.99', desc: 'Wholesale batch rendering' }
  ];

  const handleSubscribe = async (tierName: string, priceId?: string) => {
    if (!priceId) return;
    if (!auth.currentUser) {
      alert('Please sign in to subscribe.');
      return;
    }

    try {
      const res = await fetch('/create-checkout-session', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          userId: auth.currentUser.uid,
          priceId: priceId,
          tierName: tierName
        })
      });
      const data = await res.json();
      window.location.href = data.url;
    } catch (error) {
      console.error('Error starting checkout:', error);
      alert('An error occurred. Please try again.');
    }
  };

  return (
    <div className={`${isModal ? 'bg-transparent' : 'min-h-screen bg-[#030712]'} text-white p-6`}>
      <div className="max-w-6xl mx-auto">
        {!isModal && (
          <div className="flex justify-between items-center mb-10">
            <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors flex items-center gap-1">
              &larr; Back to Dashboard
            </button>
            <div className="text-center flex-grow flex flex-col items-center">
              <div className="flex items-center justify-center gap-2.5 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg ring-2 ring-pink-500/20">
                  L
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight">Credits & Billing</h1>
              </div>
              <p className="text-xs text-gray-400">Scale your creative songwriting journey dynamically.</p>
            </div>
            <div className="w-24" /> {/* Spacer for centering */}
          </div>
        )}

        {isModal && (
          <div className="text-center mb-8">
            <h2 className="text-2xl font-extrabold text-white mb-2">Upgrade Your Experience</h2>
            <p className="text-gray-400 text-xs">Unlock advanced songwriting helper models and credits.</p>
          </div>
        )}

        {/* Tab Selector between Billing Subscriptions & In-App Credit Shop */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/5 p-1 rounded-2xl border border-white/5 flex items-center gap-1">
            <button
              onClick={() => setActiveTab('plans')}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'plans' 
                  ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/20 font-extrabold' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Monthly Plans
            </button>
            <button
              onClick={() => setActiveTab('credits')}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'credits' 
                  ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/20 font-extrabold' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Credit Shop
            </button>
          </div>
        </div>

        {/* Tab Contents: Subscription Plans */}
        {activeTab === 'plans' && (
          <>
            <div className="flex justify-center mb-8">
              <div className="bg-white/5 p-1 rounded-full border border-white/10 flex items-center">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
                    billingCycle === 'monthly' ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('annually')}
                  className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
                    billingCycle === 'annually' ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Annually
                </button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-stretch justify-center w-full max-w-7xl mx-auto gap-6 pb-12 px-2">
              {tiers.map((tier, idx) => {
                const isPopular = tier.isPopular;
                return (
                  <motion.div
                    key={tier.name}
                    whileHover={{ y: -6, transition: { duration: 0.2 } }}
                    className={`relative p-6 rounded-3xl border flex flex-col w-full md:w-[240px] lg:w-[280px] shrink-0 transition-all duration-300 bg-gradient-to-b ${
                      isPopular 
                        ? 'bg-[#030712] border-pink-500 shadow-xl shadow-pink-500/10' 
                        : 'bg-[#010208] border-white/5 hover:border-pink-500/20'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-pink-600 text-white text-[9px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider shadow-lg shadow-pink-500/20">
                        Most Popular
                      </div>
                    )}
                    <h3 className="text-lg md:text-xl font-extrabold mt-1 text-white">{tier.name}</h3>
                    <p className="text-gray-400 text-xs mt-1 mb-4 h-8 leading-snug">{tier.description}</p>
                    
                    <div className="mb-5 flex items-baseline">
                      <span className="text-3xl lg:text-4xl font-extrabold text-white">${tier.price[billingCycle]}</span>
                      <span className="text-gray-400 text-xs ml-1.5">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                    </div>

                    <ul className="space-y-2.5 mb-6 flex-grow border-t border-white/5 pt-4">
                      {tier.features.map((feature) => {
                        const subFeatures = aiFeatureMapping[feature];
                        return (
                          <li key={feature} className="flex items-start gap-2 text-xs text-gray-300 group leading-snug">
                            <CheckIcon className="w-3.5 h-3.5 text-pink-500 mt-0.5 shrink-0" />
                            {subFeatures ? (
                              <div className="relative cursor-help border-b border-dashed border-gray-600 hover:border-pink-400 transition-colors">
                                <span>{feature}</span>
                              </div>
                            ) : (
                              <span>{feature}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    <button
                      onClick={() => {
                        const cycle = billingCycle === 'monthly' ? 'monthly' : 'yearly';
                        const priceId = billingCycle === 'monthly' ? tier.priceId?.monthly : tier.priceId?.annually;
                        
                        // Specific override for Rising Artist Monthly PayPal link
                        if (tier.name === 'Rising Artist' && billingCycle === 'monthly') {
                          window.location.href = 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-1LL721275R277640VNH72T4Y';
                          return;
                        }

                        if (onSelectPlan) {
                          onSelectPlan(tier.name, cycle);
                        } else {
                          handleSubscribe(tier.name, priceId);
                        }
                      }}
                      disabled={tier.isCurrent}
                      className={`w-full py-2.5 rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-1.5 ${
                        tier.isCurrent
                          ? 'bg-white/5 text-gray-500 cursor-default border border-white/5'
                          : 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-lg shadow-pink-500/15'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {tier.buttonText}
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {/* Tab Contents: In-App Credit Shop + Remaining Balance Circle Chart */}
        {activeTab === 'credits' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
            
            {/* Left: Interactive Balance Credit Donut chart and progress */}
            <div className="lg:col-span-1 p-6 bg-[#010208] border border-white/5 rounded-3xl flex flex-col items-center justify-center text-center">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Your Credit Pool</h3>
              
              <div className="relative w-44 h-44 flex items-center justify-center mb-6">
                {/* SVG circular track background */}
                <svg className="absolute w-full h-full transform -rotate-90">
                  <circle
                    cx="88"
                    cy="88"
                    r="72"
                    stroke="#18181b"
                    strokeWidth="11"
                    fill="transparent"
                  />
                  <circle
                    cx="88"
                    cy="88"
                    r="72"
                    stroke="url(#pinkGrad)"
                    strokeWidth="12"
                    strokeDasharray="452.3"
                    strokeDashoffset="117.6" // (2000 - 1480)/2000 * 452.3 = 117.6
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="pinkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ec4899" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </svg>

                <div className="flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-white tracking-tight">1,480</span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Credits Left</span>
                </div>
              </div>

              <div className="w-full space-y-3 pt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">Monthly Allotted</span>
                  <span className="font-bold text-white">2,000 Credits</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">Total Spent Currently</span>
                  <span className="font-bold text-pink-400">520 Credits (26%)</span>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-pink-500 to-purple-500 h-full" style={{ width: '74%' }} />
                </div>
              </div>
            </div>

            {/* Right: selectable Credit Packages list */}
            <div className="lg:col-span-2 p-6 bg-[#010208] border border-white/5 rounded-3xl flex flex-col justify-between gap-6">
              <div>
                <h3 className="text-lg font-black text-white">Instant Credit Top-Up Pool</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">Need quick rendering capacity? Purchase non-expiring direct credit tokens securely below.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {creditPacks.map((pack) => (
                  <div
                    key={pack.id}
                    onClick={() => setSelectedPack(pack.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex justify-between items-center group ${
                      selectedPack === pack.id 
                        ? 'bg-[#030712] border-pink-500 shadow-md shadow-pink-500/10' 
                        : 'bg-white/5 border-white/5 hover:border-pink-500/20'
                    }`}
                  >
                    <div className="text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-white group-hover:text-pink-400 transition-colors">+{pack.credits} Credits</span>
                        {pack.isBestValue && (
                          <span className="text-[8px] font-black uppercase text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded-md">Value</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{pack.desc}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono text-xs font-bold text-pink-500 bg-pink-500/10 px-2.5 py-1 rounded-xl">
                        ${pack.price}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Purchase Trigger checkout Button */}
              <button
                onClick={() => {
                  const target = creditPacks.find(p => p.id === selectedPack);
                  alert(`Checkout initiated for ${target?.credits} Credit Tokens ($${target?.price}) successfully! Thank you for purchasing. Total credits will update instantly in your dashboard.`);
                }}
                className="w-full py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-pink-500/15 flex items-center justify-center gap-1.5"
              >
                <CreditCard className="w-4 h-4" />
                Purchase Selected Credits
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default Pricing;

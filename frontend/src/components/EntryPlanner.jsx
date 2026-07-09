// frontend/src/components/EntryPlanner.jsx
import React from 'react';
import '../styles/EntryPlanner.css';
import ModelCard from './ModelCard';

const EntryPlanner = ({ formData, models, loading, error, onUpdateEqualLots, onUpdateFrontLots, onUpdateBackLots, onUpdateRaemLots, activeSpec, headerOHLC }) => {
  if (loading && !models) {
    return <div className="status-container">Calculating models...</div>;
  }

  if (error) {
    return <div className="status-container error-container">Error: {error}</div>;
  }

  if (!models) {
    return <div className="status-container">No models calculated.</div>;
  }

  return (
    <div className="entry-planner-container">
      <div className="models-grid">
        <ModelCard 
          model={models.equal} 
          formData={formData} 
          activeSpec={activeSpec} 
          headerOHLC={headerOHLC}
          isManual={true}
          onUpdateManualLots={onUpdateEqualLots}
        />
        <ModelCard 
          model={models.front_loaded} 
          formData={formData} 
          activeSpec={activeSpec} 
          headerOHLC={headerOHLC}
          isManual={true}
          onUpdateManualLots={onUpdateFrontLots}
        />
        <ModelCard 
          model={models.back_loaded} 
          formData={formData} 
          activeSpec={activeSpec} 
          headerOHLC={headerOHLC}
          isManual={true}
          onUpdateManualLots={onUpdateBackLots}
        />
        <ModelCard
          model={models.raem}
          formData={formData}
          activeSpec={activeSpec}
          headerOHLC={headerOHLC}
          isManual={true}
          onUpdateManualLots={onUpdateRaemLots}
        />
      </div>
    </div>
  );
};

export default EntryPlanner;
import React, { useState, useEffect } from 'react';
import { bundleService } from '../../services/bundleService';
import './Bundle.css';

const BundleList = ({ category = null, onBundleSelect }) => {
    const [bundles, setBundles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadBundles();
    }, [category]);

    const loadBundles = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await bundleService.getAllActiveBundles(category);
            if (response.success) {
                setBundles(response.data.bundles || []);
            }
        } catch (err) {
            setError(err.message || 'Failed to load bundles');
            console.error('Error loading bundles:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="bundle-loading">Loading bundles...</div>;
    }

    if (error) {
        return <div className="bundle-error">Error: {error}</div>;
    }

    if (bundles.length === 0) {
        return <div className="bundle-empty">No bundles available at the moment.</div>;
    }

    return (
        <div className="bundle-list">
            {bundles.map((bundle) => (
                <div 
                    key={bundle.bundleID} 
                    className="bundle-card"
                    onClick={() => onBundleSelect && onBundleSelect(bundle)}
                >
                    <div className="bundle-header">
                        <h3 className="bundle-name">{bundle.bundleName}</h3>
                        <span className="bundle-price">${bundle.price}</span>
                    </div>
                    <div className="bundle-provider">
                        <span>Provider: {bundle.providerName}</span>
                    </div>
                    {bundle.description && (
                        <p className="bundle-description">{bundle.description}</p>
                    )}
                    <div className="bundle-services">
                        <strong>Services Included:</strong>
                        <ul>
                            {bundle.servicesIncluded && bundle.servicesIncluded.map((service, index) => (
                                <li key={index}>{service}</li>
                            ))}
                        </ul>
                    </div>
                    {bundle.validTill && (
                        <div className="bundle-validity">
                            Valid until: {new Date(bundle.validTill).toLocaleDateString()}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default BundleList;


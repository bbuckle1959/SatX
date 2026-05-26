import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';

import type { SatelliteCoordinates } from '../hooks/useSatellitePropagation';
import type { DishSite } from '../lib/dishSite';
import {
  GLOBE_RADIAL_BIAS,
  GLOBE_SURFACE_BIAS,
  geodeticToCartesian,
} from '../lib/geo';

const BEAM_COLOR = '#fbbf24';

interface StarlinkServicingLayerProps {
  dishSite: DishSite;
  servicingStarlinkIdRef: RefObject<string | null>;
  positionsRef: RefObject<SatelliteCoordinates[]>;
}

function ServicingBeam({
  dishSite,
  servicingStarlinkIdRef,
  positionsRef,
}: {
  dishSite: DishSite;
  servicingStarlinkIdRef: RefObject<string | null>;
  positionsRef: RefObject<SatelliteCoordinates[]>;
}) {
  const dishSiteRef = useRef(dishSite);
  dishSiteRef.current = dishSite;

  const lineRef = useRef<THREE.Line | null>(null);
  const geometryRef = useRef(new THREE.BufferGeometry());
  const positionArrayRef = useRef(new Float32Array(6));

  const line = useMemo(() => {
    const geometry = geometryRef.current;
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positionArrayRef.current, 3),
    );
    const material = new THREE.LineDashedMaterial({
      color: BEAM_COLOR,
      transparent: true,
      opacity: 0.38,
      dashSize: 0.03,
      gapSize: 0.022,
      depthWrite: false,
      toneMapped: false,
    });
    const obj = new THREE.Line(geometry, material);
    obj.renderOrder = 5;
    obj.frustumCulled = false;
    obj.visible = false;
    lineRef.current = obj;
    return obj;
  }, []);

  useEffect(
    () => () => {
      geometryRef.current.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );

  useFrame(() => {
    const id = servicingStarlinkIdRef.current;
    const obj = lineRef.current;
    if (!obj || !id) {
      if (obj) obj.visible = false;
      return;
    }

    const satellites = positionsRef.current;
    let sat: SatelliteCoordinates | undefined;
    for (let i = 0; i < satellites.length; i += 1) {
      if (satellites[i].id === id) {
        sat = satellites[i];
        break;
      }
    }
    if (!sat) {
      obj.visible = false;
      return;
    }

    const site = dishSiteRef.current;
    const [hx, hy, hz] = geodeticToCartesian(
      site.latitude,
      site.longitude,
      0,
    );
    const [sx, sy, sz] = geodeticToCartesian(
      sat.latitude,
      sat.longitude,
      sat.altitude,
    );

    const arr = positionArrayRef.current;
    arr[0] = hx * GLOBE_SURFACE_BIAS;
    arr[1] = hy * GLOBE_SURFACE_BIAS;
    arr[2] = hz * GLOBE_SURFACE_BIAS;
    arr[3] = sx * GLOBE_RADIAL_BIAS;
    arr[4] = sy * GLOBE_RADIAL_BIAS;
    arr[5] = sz * GLOBE_RADIAL_BIAS;

    const attr = geometryRef.current.getAttribute(
      'position',
    ) as THREE.BufferAttribute;
    attr.needsUpdate = true;
    obj.computeLineDistances();
    obj.visible = true;
  });

  return <primitive object={line} />;
}

export function StarlinkServicingLayer({
  dishSite,
  servicingStarlinkIdRef,
  positionsRef,
}: StarlinkServicingLayerProps) {
  return (
    <ServicingBeam
      dishSite={dishSite}
      servicingStarlinkIdRef={servicingStarlinkIdRef}
      positionsRef={positionsRef}
    />
  );
}

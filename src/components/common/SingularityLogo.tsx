import React from 'react';
import { SvgCss } from 'react-native-svg/css';
import { singularityLogoXml } from '../../assets/singularityLogoXml';

interface Props {
  size?: number;
}

/**
 * The real Singularity brand mark (SingularityOnly.svg).
 *
 * Uses SvgCss (not SvgXml) because the source SVG styles its paths through a
 * <style> block with CSS classes, which the plain XML renderer ignores. The
 * artwork is square (viewBox 0 0 1024 1024), so width === height.
 */
export const SingularityLogo = ({ size = 96 }: Props) => (
  <SvgCss xml={singularityLogoXml} width={size} height={size} />
);

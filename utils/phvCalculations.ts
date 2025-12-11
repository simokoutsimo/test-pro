export interface PHVInputData {
  gender: 'male' | 'female';
  ageYears: number;
  ageMonths: number;
  height: number;
  sittingHeight: number;
  weight: number;
}

export interface PHVResult {
  maturityOffset: number;
  predictedAgeAtPHV: number;
  legLength: number;
  maturityStatus: 'pre-PHV' | 'circa-PHV' | 'post-PHV';
  maturityDescription: string;
}

export function calculatePHV(data: PHVInputData): PHVResult {
  const age = data.ageYears + data.ageMonths / 12;

  const legLength = data.height - data.sittingHeight;

  const weightHeightRatio = (data.weight / data.height) * 100;

  let maturityOffset: number;

  if (data.gender === 'male') {
    maturityOffset =
      -9.236 +
      0.0002708 * (legLength * data.sittingHeight) +
      -0.001663 * (age * legLength) +
      0.007216 * (age * data.sittingHeight) +
      0.02292 * weightHeightRatio;
  } else {
    maturityOffset =
      -9.376 +
      0.0001882 * (legLength * data.sittingHeight) +
      0.0022 * (age * legLength) +
      0.005841 * (age * data.sittingHeight) +
      -0.002658 * (age * data.weight) +
      0.07693 * weightHeightRatio;
  }

  const predictedAgeAtPHV = age - maturityOffset;

  let maturityStatus: 'pre-PHV' | 'circa-PHV' | 'post-PHV';
  let maturityDescription: string;

  if (maturityOffset < -1) {
    maturityStatus = 'pre-PHV';
    maturityDescription = 'Pre-PHV: More than 1 year before peak growth';
  } else if (maturityOffset > 1) {
    maturityStatus = 'post-PHV';
    maturityDescription = 'Post-PHV: More than 1 year after peak growth';
  } else {
    maturityStatus = 'circa-PHV';
    maturityDescription = 'Circa-PHV: Within 1 year of peak growth';
  }

  return {
    maturityOffset,
    predictedAgeAtPHV,
    legLength,
    maturityStatus,
    maturityDescription
  };
}

export function getMaturityInterpretation(maturityOffset: number): {
  status: string;
  description: string;
  recommendations: string[];
} {
  const absOffset = Math.abs(maturityOffset);

  if (maturityOffset < -2) {
    return {
      status: 'Early Pre-PHV',
      description: `${absOffset.toFixed(1)} years before peak growth. Early development phase.`,
      recommendations: [
        'Focus on fundamental movement skills',
        'Build general athletic foundation',
        'Emphasis on technique and coordination',
        'Moderate training volume',
        'Avoid early specialization'
      ]
    };
  } else if (maturityOffset < -1) {
    return {
      status: 'Late Pre-PHV',
      description: `${absOffset.toFixed(1)} years before peak growth. Approaching growth spurt.`,
      recommendations: [
        'Continue skill development',
        'Introduce strength training basics',
        'Monitor for growth-related changes',
        'Focus on proper movement patterns',
        'Prepare for upcoming growth phase'
      ]
    };
  } else if (maturityOffset <= 1) {
    return {
      status: 'Circa-PHV',
      description: 'Currently experiencing peak height velocity - rapid growth phase.',
      recommendations: [
        'Be aware of increased injury risk',
        'Adjust training loads carefully',
        'Focus on maintaining movement quality',
        'Monitor for coordination changes',
        'Emphasize recovery and nutrition',
        'Reduce high-impact activities if needed'
      ]
    };
  } else if (maturityOffset <= 2) {
    return {
      status: 'Early Post-PHV',
      description: `${maturityOffset.toFixed(1)} years after peak growth. Growth rate slowing.`,
      recommendations: [
        'Increase strength training emphasis',
        'Develop power and speed',
        'Build sport-specific skills',
        'Progressive load increases',
        'Optimize athletic performance'
      ]
    };
  } else {
    return {
      status: 'Late Post-PHV',
      description: `${maturityOffset.toFixed(1)} years after peak growth. Mature development.`,
      recommendations: [
        'Maximize strength and power',
        'Focus on advanced technical skills',
        'Sport-specific conditioning',
        'High-performance training',
        'Competition preparation'
      ]
    };
  }
}

export function getTypicalPHVAge(gender: 'male' | 'female'): { average: number; range: string } {
  if (gender === 'male') {
    return {
      average: 13.5,
      range: '12-15 years'
    };
  } else {
    return {
      average: 11.5,
      range: '10-13 years'
    };
  }
}

import {
  Chart as ChartJS,
  LineController, BarController, DoughnutController, RadarController,
  CategoryScale, LinearScale, RadialLinearScale,
  BarElement, ArcElement, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js';

ChartJS.register(
  LineController, BarController, DoughnutController, RadarController,
  CategoryScale, LinearScale, RadialLinearScale,
  BarElement, ArcElement, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
);

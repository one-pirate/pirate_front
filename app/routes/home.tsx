import type { Route } from "./+types/home";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "OnePirate - Home" },
    { name: "description", content: "Welcome to OnePirate - AI Pirate Risk Prediction" },
  ];
}

export default function Home() {
  return (
    <section className="min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-slate-900 dark:to-gray-800 text-slate-800 dark:text-slate-200 flex items-center justify-center transition-colors duration-500">
      <div className="container mx-auto px-4 py-10">
        <div className="text-center">
          <h1 className="text-5xl font-extrabold mb-4">
            OnePirate
          </h1>
          <h2 className="text-2xl font-semibold mb-8">
            Découvrez le risque de piraterie sur vos routes maritimes.
          </h2>
          <div className="my-8 max-w-2xl mx-auto">
            <p className="text-justify text-lg">
              Cette application utilise un modèle d'intelligence artificielle avancé pour prédire la probabilité d'attaques pirates le long de vos itinéraires. En analysant les données géospatiales, notre IA vous aide à planifier des trajets plus sûrs. Vous pouvez tracer un chemin sur la carte, et l'IA évaluera le risque de piraterie pour chaque segment, vous permettant de visualiser les zones dangereuses et d'ajuster votre parcours en conséquence.
            </p>
          </div>
          <div className="flex justify-center mt-12">
            <Link 
              to="/map" 
              className="bg-white/30 dark:bg-white/10 text-gray-900 dark:text-white font-bold py-4 px-8 rounded-full shadow-lg border border-white/40 dark:border-white/20 backdrop-blur-md hover:bg-white/40 dark:hover:bg-white/20 transition-all duration-300 ease-in-out text-xl"
            >
              Commencer la navigation
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

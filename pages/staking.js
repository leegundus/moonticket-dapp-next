export default function RetiredPage() {
  return null;
}

export function getServerSideProps() {
  return {
    redirect: {
      destination: "/Moontickets",
      permanent: false,
    },
  };
}

export default function RetiredPage() {
  return null;
}

export function getServerSideProps() {
  return {
    redirect: {
      destination: "/",
      permanent: false,
    },
  };
}

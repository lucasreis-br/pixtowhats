
export async function getServerSideProps({ query }) {
  if (!query.t) return { notFound: true }
  return { props: {} }
}

export default function App() {
  return (
    <iframe
      src="/ebook.html"
      style={{ border: 'none', width: '100vw', height: '100vh' }}
    />
  )
}
